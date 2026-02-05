import React from 'react';
import { Play, Pause } from 'lucide-react';

interface PlayerOverlayProps {
  isPlaying: boolean;
  isBuffering: boolean;
  onTogglePlay: () => void;
}

export const PlayerOverlay: React.FC<PlayerOverlayProps> = ({ isPlaying, isBuffering, onTogglePlay }) => {
  return (
    <div 
      className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
    >
      {isBuffering ? (
        <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
          className={`p-6 bg-black/40 backdrop-blur-sm rounded-full text-white hover:bg-black/60 hover:scale-110 transition-all duration-200 pointer-events-auto ${isPlaying ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 fill-current" />
          ) : (
            <Play className="w-8 h-8 fill-current ml-1" />
          )}
        </button>
      )}
    </div>
  );
};
