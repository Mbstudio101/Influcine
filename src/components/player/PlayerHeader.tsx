import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface PlayerHeaderProps {
  title?: string;
  onBack?: () => void;
  showControls: boolean;
  audioFormat?: 'atmos' | '5.1' | 'stereo';
}

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({ title, onBack, showControls, audioFormat }) => {
  return (
    <div className={`absolute top-0 left-0 right-0 p-4 bg-linear-to-b from-black/80 to-transparent transition-opacity duration-300 z-110 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} style={{ pointerEvents: showControls ? 'none' : 'none' }}>
      <div className="flex items-center gap-4 w-full pointer-events-auto">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-white text-lg font-medium truncate drop-shadow-md flex-1">
          {title || 'Playing'}
        </h1>
        
        {audioFormat === 'atmos' && (
             <div className="mr-4 px-2 py-1 rounded border border-white/20 bg-black/40 backdrop-blur-sm">
                 <span className="text-[10px] font-bold text-white tracking-widest">DOLBY ATMOS</span>
             </div>
        )}
      </div>
    </div>
  );
};
