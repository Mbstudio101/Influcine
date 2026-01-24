import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Minimize2, Maximize2, X } from 'lucide-react';
import clsx from 'clsx';

interface TitleBarProps {
  className?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Handle window controls
  const handleMinimize = () => {
    if (window.ipcRenderer) {
      window.ipcRenderer.send('window-minimize');
    }
  };

  const handleMaximize = () => {
    if (window.ipcRenderer) {
      window.ipcRenderer.send('window-maximize');
    }
  };

  const handleClose = () => {
    if (window.ipcRenderer) {
      window.ipcRenderer.send('window-close');
    }
  };

  // Determine if we should show the back button
  // Don't show on root landing page, login, or main browse page if it's the root of the app
  const showBackButton = location.pathname !== '/' && location.pathname !== '/login' && location.pathname !== '/browse' && location.pathname !== '/profiles';

  return (
    <div className={clsx("h-10 bg-black/50 backdrop-blur-md flex items-center justify-between px-4 fixed top-0 z-50 select-none drag-region border-b border-white/5", className || "w-full")}>
      <div className="flex items-center gap-2 no-drag">
        {showBackButton && (
          <button 
            onClick={() => navigate(-1)}
            className="p-1 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 no-drag">
        <button 
          onClick={handleMinimize}
          className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white"
        >
          <Minimize2 size={14} />
        </button>
        <button 
          onClick={handleMaximize}
          className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white"
        >
          <Maximize2 size={14} />
        </button>
        <button 
          onClick={handleClose}
          className="p-1.5 hover:bg-red-500 hover:text-white rounded-md transition-colors text-gray-400"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
