import React from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Settings, 
  Maximize, Minimize, PictureInPicture, SkipForward 
} from 'lucide-react';
import Focusable from '../Focusable';

interface PlayerControlsProps {
  showControls: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  isPip: boolean;
  onPipToggle?: () => void;
  onNext?: () => void;
  formatTime: (time: number) => string;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  showControls,
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  isMuted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  onOpenSettings,
  isPip,
  onPipToggle,
  onNext,
  formatTime
}) => {
  return (
    <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-4 pt-12 transition-opacity duration-300 z-50 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      
      {/* Timeline */}
      <div className="group relative flex items-center mb-4 cursor-pointer">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={onSeek}
          className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
        />
        <div 
          className="absolute h-1 bg-red-600 rounded-l-lg pointer-events-none"
          style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Focusable onEnter={onTogglePlay}>
            <button 
              onClick={onTogglePlay}
              className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>
          </Focusable>

          {onNext && (
            <Focusable onEnter={onNext}>
              <button 
                onClick={onNext}
                className="p-2 hover:bg-white/10 rounded-full text-white transition-colors group"
                title="Next Episode"
              >
                <SkipForward className="w-5 h-5 fill-current opacity-70 group-hover:opacity-100" />
              </button>
            </Focusable>
          )}

          <div className="group relative flex items-center gap-2">
            <Focusable onEnter={onToggleMute}>
              <button 
                onClick={onToggleMute}
                className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
            </Focusable>
            <div className="w-0 overflow-hidden group-hover:w-24 transition-all duration-300 ease-in-out">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>

          <span className="text-sm font-medium text-gray-300 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onPipToggle && document.pictureInPictureEnabled && (
             <Focusable onEnter={onPipToggle}>
               <button 
                 onClick={onPipToggle}
                 className={`p-2 hover:bg-white/10 rounded-full text-white transition-colors ${isPip ? 'text-blue-400' : ''}`}
                 title="Picture in Picture"
               >
                 <PictureInPicture className="w-5 h-5" />
               </button>
             </Focusable>
          )}

          <Focusable onEnter={onOpenSettings}>
            <button 
              onClick={onOpenSettings}
              className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </Focusable>

          <Focusable onEnter={onToggleFullscreen}>
            <button 
              onClick={onToggleFullscreen}
              className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </Focusable>
        </div>
      </div>
    </div>
  );
};
