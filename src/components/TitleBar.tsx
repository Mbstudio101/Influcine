import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Minimize2, Maximize2, X, Square, Crown } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/useAuth';
import { Avatar } from './Avatars';

interface TitleBarProps {
  className?: string;
  isOverlay?: boolean;
}

const TitleBar: React.FC<TitleBarProps> = ({ className, isOverlay = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [isMaximized, setIsMaximized] = useState(false);
  const ipc = typeof window !== 'undefined' ? window.ipcRenderer : undefined;

  // Handle window controls
  const handleMinimize = useCallback(() => {
    if (ipc) {
      ipc.send('window-minimize');
    }
  }, [ipc]);

  const handleMaximize = useCallback(async () => {
    if (ipc) {
      // Prefer invoke so renderer and main stay in sync.
      try {
        const maximized = await ipc.invoke('window-toggle-maximize');
        setIsMaximized(Boolean(maximized));
      } catch {
        ipc.send('window-maximize');
        setIsMaximized(prev => !prev);
      }
    }
  }, [ipc]);

  const handleClose = useCallback(() => {
    if (ipc) {
      ipc.send('window-close');
    }
  }, [ipc]);

  useEffect(() => {
    let active = true;
    const syncMaxState = async () => {
      if (!ipc) return;
      try {
        const maximized = await ipc.invoke('window-is-maximized');
        if (active) setIsMaximized(Boolean(maximized));
      } catch {
        // Ignore in web mode or when channel is unavailable.
      }
    };
    syncMaxState();
    return () => {
      active = false;
    };
  }, [ipc]);

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
  }, [handleClose, handleMaximize, handleMinimize]);

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
        {!isOverlay && profile && (
          <div className="mr-1 flex items-center gap-2.5 px-2 py-1 rounded-full bg-white/8 border border-white/15">
            <div className="w-7 h-7 rounded-full overflow-hidden border border-white/30">
              <Avatar id={profile.avatarId || 'human-m-1'} />
            </div>
            <div className="hidden md:block leading-tight">
              <div className="text-[11px] text-white font-semibold">{profile.name || 'Account'}</div>
              <div className="text-[10px] text-[#f7d26a] flex items-center gap-1">
                <Crown size={10} className="fill-[#f7d26a] text-[#f7d26a]" />
                Premium Member
              </div>
            </div>
          </div>
        )}
        {!ipc ? null : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

export default TitleBar;
