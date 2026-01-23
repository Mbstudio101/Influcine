import React from 'react';
import { Minus, Square, X } from 'lucide-react';

const TitleBar: React.FC = () => {
  const handleMinimize = () => {
    window.ipcRenderer.send('window-minimize');
  };

  const handleMaximize = () => {
    window.ipcRenderer.send('window-maximize');
  };

  const handleClose = () => {
    window.ipcRenderer.send('window-close');
  };

  const dragStyle: React.CSSProperties & { WebkitAppRegion?: string } = { WebkitAppRegion: 'drag' };
  const noDragStyle: React.CSSProperties & { WebkitAppRegion?: string } = { WebkitAppRegion: 'no-drag' };

  return (
    <div className="h-10 bg-black/80 backdrop-blur-2xl flex items-center justify-end select-none fixed top-0 left-20 right-0 z-100 border-b border-white/5" style={dragStyle}>
      <div className="flex h-full" style={noDragStyle}>
        <button
          onClick={handleMinimize}
          className="w-12 h-full hover:bg-white/5 transition-colors flex items-center justify-center text-textSecondary hover:text-white"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-12 h-full hover:bg-white/5 transition-colors flex items-center justify-center text-textSecondary hover:text-white"
        >
          <Square size={14} />
        </button>
        <button
          onClick={handleClose}
          className="w-12 h-full hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center text-textSecondary"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
