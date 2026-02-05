import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Minimize2, Maximize2, X, Square } from 'lucide-react';
import clsx from 'clsx';

interface TitleBarProps {
  className?: string;
  isOverlay?: boolean;
}

const TitleBar: React.FC<TitleBarProps> = ({ className, isOverlay = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMaximized, setIsMaximized] = useState(false);

  // Handle window controls
  const handleMinimize = () => {
    if (window.ipcRenderer) {
      window.ipcRenderer.send('window-minimize');
    }
  };

  const handleMaximize = () => {
    if (window.ipcRenderer) {
      window.ipcRenderer.send('window-maximize');
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = () => {
    if (window.ipcRenderer) {
      window.ipcRenderer.send('window-close');
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Minimize: Ctrl/Cmd + M
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        handleMinimize();
      }
      
      // Fullscreen: F11 or Ctrl/Cmd + F
      if (e.key === 'F11' || ((e.ctrlKey || e.metaKey) && e.key === 'f')) {
        e.preventDefault();
        handleMaximize();
      }

      // Close: Alt + F4 or Cmd + Q
      if ((e.altKey && e.key === 'F4') || (e.metaKey && e.key === 'q')) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // Determine if we should show the back button
  // Don't show on root landing page, login, or main browse page if it's the root of the app
  const showBackButton = !isOverlay && location.pathname !== '/' && location.pathname !== '/login' && location.pathname !== '/browse' && location.pathname !== '/profiles';

  return (
    <div 
      className={clsx(
        "h-10 flex items-center justify-between px-4 fixed top-0 z-[100] select-none transition-opacity duration-300", 
        isOverlay ? "bg-transparent w-full" : "bg-black/50 backdrop-blur-md border-b border-white/5",
        className || "w-full"
      )} 
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {showBackButton && (
          <button 
            onClick={() => navigate(-1)}
            className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button 
          onClick={handleMinimize}
          className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white"
          title="Minimize"
        >
          <Minimize2 size={14} />
        </button>
        <button 
          onClick={handleMaximize}
          className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white"
          title={isMaximized ? "Restore Down" : "Maximize"}
        >
          {isMaximized ? <Square size={12} /> : <Maximize2 size={14} />}
        </button>
        <button 
          onClick={handleClose}
          className="p-1.5 hover:bg-red-500 hover:text-white rounded-md transition-colors text-gray-400"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
