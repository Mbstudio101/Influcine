import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { errorAgent } from '../services/errorAgent';

const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
        <p className="text-gray-400 mb-8">
          We encountered an unexpected error. Please try reloading the application.
        </p>

        <div className="bg-black/30 rounded-lg p-4 mb-8 text-left overflow-auto max-h-40">
          <code className="text-xs text-red-400 font-mono">
            {error?.message || 'Unknown error'}
          </code>
        </div>

        <button
          onClick={resetErrorBoundary}
          className="w-full py-3 px-6 bg-primary hover:bg-primary/80 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 group"
        >
          <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
          Reload Application
        </button>
      </div>
    </div>
  );
};

interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
}

const GlobalErrorBoundary: React.FC<GlobalErrorBoundaryProps> = ({ children }) => {
  const logError = (error: Error, info: { componentStack: string }) => {
    // Send to centralized error agent
    errorAgent.log({
      message: error.message,
      stack: error.stack,
      type: 'CRITICAL',
      context: { componentStack: info.componentStack }
    });
  };

  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={logError}
      onReset={() => window.location.reload()}
    >
      {children}
    </ReactErrorBoundary>
  );
};

export default GlobalErrorBoundary;
