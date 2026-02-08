import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.tsx'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import { SettingsProvider } from './context/SettingsContext'
import { AuthProvider } from './context/AuthContext'
import { TVNavigationProvider } from './context/TVNavigationContext'
import { ToastProvider } from './context/ToastContext'
import './index.css'
import { errorAgent } from './services/errorAgent'

// Initialize Error Logging Agent
errorAgent.init();

import { performRescue, restoreFromRescueDB } from './services/dbRescue';
import { db } from './db';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 24, // 24 hours (Aggressive caching for speed)
      gcTime: 1000 * 60 * 60 * 48, // 48 hours
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false, // Don't refetch on component mount if cached
      refetchOnReconnect: false,
    },
  },
});

const initApp = async () => {
  // Check for DB health by trying to open the REAL app database
  let wasRescued = false;
  
  try {
    // Attempt to open. If this fails with UpgradeError/VersionError, we rescue.
    await db.open();
    // If successful, we can verify if a previous rescue needs restoration
    await restoreFromRescueDB(db);
  } catch (err: unknown) {
    const dbErr = err as { name?: string; message?: string };
    errorAgent.log({ message: '[Main] Database open failed', type: 'CRITICAL', context: { error: String(err) } });
    if (dbErr.name === 'DexieError' || dbErr.name === 'UpgradeError' || dbErr.name === 'VersionError' || dbErr.message?.includes('primary key') || dbErr.name === 'DexieError2') {
       wasRescued = await performRescue('InflucineDB');
    }
  }

  if (wasRescued) {
    // If rescued, the DB was deleted. The next access (db.open) will recreate it.
    // We explicitly open it now to ensure schema creation happens before we try to restore.
    try {
        await db.open();
        await restoreFromRescueDB(db);
        // Reload page to ensure clean state
        window.location.reload();
        return; // Stop execution here
    } catch (e) {
        errorAgent.log({ message: 'Failed to reopen DB after rescue', type: 'CRITICAL', context: { error: String(e) } });
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <TVNavigationProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </TVNavigationProvider>
          </SettingsProvider>
        </AuthProvider>
        {/* {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />} */}
      </QueryClientProvider>
    </GlobalErrorBoundary>,
  );
};

initApp();


// Use contextBridge
window.ipcRenderer?.on('main-process-message', () => {
  if (import.meta.env.DEV) {
    // console.log(message)
  }
})
