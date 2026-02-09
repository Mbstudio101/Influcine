import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import { useAuth } from './context/useAuth';
import { 
  checkForUpdates, 
  getPlatformDownloadLink, 
  skipUpdate, 
  downloadUpdate, 
  installUpdate, 
  onUpdateProgress, 
  onUpdateDownloaded 
} from './services/updateService';
import { AppVersion } from './types';
import pkg from '../package.json';
import { migrateDatabaseIds } from './services/migration';
import { CleanupAgent } from './services/CleanupAgent';
import { PlayerProvider } from './context/PlayerContext';
import GlobalPlayer from './components/GlobalPlayer';
import BugReporter from './components/BugReporter';

// Lazy load components
const UpdateModal = lazy(() => import('./components/UpdateModal'));

// Lazy load pages for better performance
const Home = lazy(() => import('./pages/Home'));
const Search = lazy(() => import('./pages/Search'));
const Watchlist = lazy(() => import('./pages/Watchlist'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Details = lazy(() => import('./pages/Details'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ProfileSelection = lazy(() => import('./pages/ProfileSelection'));
const Genre = lazy(() => import('./pages/Genre'));

const LoadingFallback = () => (
  <div className="h-screen w-full bg-black flex items-center justify-center">
    <div className="w-16 h-16 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children, requireProfile = true }: { children: JSX.Element, requireProfile?: boolean }) => {
  const { isAuthenticated, profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireProfile && !profile) {
    return <Navigate to="/profiles" replace />;
  }

  return children;
};

const PublicOnlyRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/profiles" replace />;
  }
  return children;
};

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState<AppVersion | null>(null);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateReady, setUpdateReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    // Listen for update progress
    const cleanupProgress = onUpdateProgress((progress) => {
      setUpdateDownloading(true);
      setUpdateProgress(progress.percent);
    });

    // Listen for update downloaded
    const cleanupDownloaded = onUpdateDownloaded(() => {
      setUpdateDownloading(false);
      setUpdateReady(true);
      setUpdateProgress(100);
    });

    // Listen for update errors — reset downloading state so user can retry
    const handleUpdateError = () => {
      setUpdateDownloading(false);
      setUpdateProgress(0);
    };
    window.ipcRenderer?.on('update-error', handleUpdateError);

    return () => {
      cleanupProgress();
      cleanupDownloaded();
      window.ipcRenderer?.off('update-error', handleUpdateError);
    };
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Defer heavy DB operations to improve TTI
    const runMaintenance = async () => {
      // Run DB migrations
      await migrateDatabaseIds();
      
      // Run automatic cleanup
      CleanupAgent.runCleanup().then(report => {
        const totalRemoved = 
          report.libraryRemoved + 
          report.historyRemoved + 
          report.episodeProgressRemoved + 
          report.sourceMemoryRemoved;

        if (totalRemoved > 0) {
          // console.log('[AutoCleanup] Cleanup Report:', report);
        }
      });
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => runMaintenance());
    } else {
      setTimeout(runMaintenance, 2000);
    }

    const check = async () => {
      try {
        const update = await checkForUpdates(pkg.version);
        if (update) {
          setUpdateAvailable(update);
        }
      } catch (error) {
        console.warn('Update check failed', error);
      }
    };
    check();
  }, []);

  const handleUpdate = async () => {
    if (!updateAvailable) return;

    if (updateReady) {
      try {
        await installUpdate();
      } catch (error) {
        console.error('Failed to install update:', error);
      }
      return;
    }

    // Check if this update came from the native Electron autoUpdater (platforms = 'ipc')
    const isNativeUpdate = updateAvailable.platforms.macos === 'ipc' ||
                           updateAvailable.platforms.windows === 'ipc' ||
                           updateAvailable.platforms.linux === 'ipc';

    if (isNativeUpdate) {
      // Use Electron's autoUpdater for in-app download + install
      try {
        setUpdateDownloading(true);
        setUpdateProgress(0);
        await downloadUpdate();
        // Progress and completion are handled by IPC event listeners
      } catch (error) {
        console.error('Native update download failed:', error);
        setUpdateDownloading(false);
        setUpdateProgress(0);
      }
    } else {
      // GitHub API fallback — open download link in browser
      const link = getPlatformDownloadLink(updateAvailable);
      if (link) {
        window.open(link, '_blank');
      } else {
        console.warn('No download link found for this platform');
      }
    }
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <PlayerProvider>
      <>
        {updateAvailable && (
          <UpdateModal 
            update={updateAvailable} 
            onClose={() => {
              skipUpdate(updateAvailable.latest);
              setUpdateAvailable(null);
            }}
            onUpdate={handleUpdate}
            downloading={updateDownloading}
            progress={updateProgress}
            readyToInstall={updateReady}
          />
        )}
        <BugReporter />
        <Router>
          <GlobalPlayer />
          <div className="h-screen w-full bg-black text-white overflow-hidden flex flex-col select-none">
            {/* Custom Title Bar (Mac Style) */}
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
            <Route path="/" element={<Navigate to="/browse" replace />} />
            <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
            <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
            
            <Route 
              path="/profiles" 
              element={
                <ProtectedRoute requireProfile={false}>
                  <ProfileSelection />
                </ProtectedRoute>
              } 
            />
            
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/browse" element={<Home />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/calendar" element={<Calendar />} />
                      <Route path="/watchlist" element={<Watchlist />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/details/:type/:id" element={<Details />} />
                      <Route path="/genre/:id" element={<Genre />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </>
    </PlayerProvider>
  );
}

export default App;
