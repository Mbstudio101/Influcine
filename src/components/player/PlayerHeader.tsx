import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface PlayerHeaderProps {
  title?: string;
  onBack?: () => void;
  showControls: boolean;
}

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({ title, onBack, showControls }) => {
  return (
    <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-50 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-lg font-medium truncate drop-shadow-md">
          {title || 'Playing'}
        </h1>
      </div>
    </div>
  );
};
