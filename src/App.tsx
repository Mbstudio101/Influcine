import { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import Home from './pages/Home';
import Search from './pages/Search';
import Watchlist from './pages/Watchlist';
import Player from './pages/Player';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Details from './pages/Details';
import Calendar from './pages/Calendar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ProfileSelection from './pages/ProfileSelection';
import { useAuth } from './context/useAuth';
import { checkForUpdates, getPlatformDownloadLink, skipUpdate } from './services/updateService';
import UpdateModal from './components/UpdateModal';
import { AppVersion } from './types';
import pkg from '../package.json';

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

  useEffect(() => {
    const check = async () => {
      try {
        const update = await checkForUpdates(pkg.version);
        if (update) {
          setUpdateAvailable(update);
        }
      } catch (error) {
        console.error('Update check failed', error);
      }
    };
    check();
  }, []);

  const handleUpdate = () => {
    if (!updateAvailable) return;
    const link = getPlatformDownloadLink(updateAvailable);
    if (link) {
      window.open(link, '_blank');
    } else {
      alert('Update available but no download link found for your platform.');
    }
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <>
      {updateAvailable && (
        <UpdateModal 
          update={updateAvailable} 
          onClose={() => {
            skipUpdate(updateAvailable.latest);
            setUpdateAvailable(null);
          }}
          onUpdate={handleUpdate}
        />
      )}
      <Router>
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
          path="/watch/:type/:id" 
          element={
            <ProtectedRoute>
              <Player />
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
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
    </>
  );
}

export default App;
