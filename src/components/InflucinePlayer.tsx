import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Maximize, 
  Minimize, 
  Volume2, 
  VolumeX, 
  Settings, 
  SkipForward, 
  SkipBack,
  Check,
  ArrowLeft
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

interface InflucinePlayerProps {
  src: string;
  poster?: string;
  title?: string;
  onBack?: () => void;
  onNext?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  startTime?: number;
}

const InflucinePlayer: React.FC<InflucinePlayerProps> = ({ 
  src, 
  poster, 
  title, 
  onBack, 
  onNext,
  onTimeUpdate,
  startTime = 0
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const { themeColor } = useSettings();
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Format time (e.g. 1:30:05)
  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Initialize
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      setVolume(videoRef.current.volume);
    }
  }, [startTime]);

  // Handle controls visibility
  useEffect(() => {
    const handleActivity = () => {
      setShowControls(true);
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleActivity);
      container.addEventListener('click', handleActivity);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleActivity);
        container.removeEventListener('click', handleActivity);
      }
      clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      // Use ref current state if possible, but we need React state for re-render
      // We can access the current muted state from the video element directly to avoid closure issues
      const newMuted = !videoRef.current.muted; // Trust video element state as source of truth
      
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  }, []);

  const changeSpeed = useCallback((speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSettings(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch(e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, videoRef.current.duration);
          break;
        case 'ArrowLeft':
          videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(volume + 0.1, 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(volume - 0.1, 0));
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'KeyM':
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, togglePlay, toggleFullscreen, toggleMute, handleVolumeChange]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (onTimeUpdate) {
        onTimeUpdate(videoRef.current.currentTime, videoRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black group overflow-hidden font-sans select-none"
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
      />

      {/* Loading Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Top Gradient */}
      <div className={`absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-black/80 to-transparent transition-opacity duration-300 z-20 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="p-6 flex items-center gap-4">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all hover:scale-110"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <h1 className="text-xl font-bold text-white drop-shadow-md">{title}</h1>
          
          {onNext && (
            <button 
              onClick={onNext}
              className="ml-auto px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold text-sm transition-colors"
            >
              Next Episode
            </button>
          )}
        </div>
      </div>

      {/* Main Controls Container */}
      <div className={`absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 z-30 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        
        {/* Progress Bar */}
        <div className="group/progress relative h-2 mb-4 cursor-pointer">
          {/* Background Track */}
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
             {/* Buffer Bar (Mock for now, normally computed from buffered ranges) */}
             <div 
               className="absolute top-0 left-0 bottom-0 bg-white/10" 
               style={{ width: `${(currentTime / duration) * 100 + 10}%` }}
             />
          </div>
          
          {/* Fill Track */}
          <div 
            className="absolute top-0 left-0 bottom-0 rounded-full transition-all duration-100"
            style={{ 
              width: `${(currentTime / duration) * 100}%`,
              backgroundColor: themeColor
            }}
          >
            {/* Handle */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-0 group-hover/progress:scale-100 transition-transform" />
            
            {/* Glow Effect */}
            <div 
              className="absolute right-0 top-1/2 -translate-y-1/2 w-20 h-20 bg-primary/40 blur-xl rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" 
              style={{ backgroundColor: themeColor }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all hover:scale-110"
            >
              {isPlaying ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} className="ml-1" />}
            </button>

            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }} className="text-white/70 hover:text-white transition-colors">
              <SkipBack size={24} />
            </button>
            <button onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }} className="text-white/70 hover:text-white transition-colors">
              <SkipForward size={24} />
            </button>

            <div className="group/volume flex items-center gap-2 ml-2">
              <button onClick={toggleMute} className="text-white hover:text-primary transition-colors">
                {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>
              <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            </div>

            <span className="text-sm font-medium text-white/80 tabular-nums tracking-wider">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Settings Menu */}
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full transition-all ${showSettings ? 'bg-white/20 rotate-90 text-white' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
              >
                <Settings size={24} />
              </button>
              
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="absolute bottom-14 right-0 w-64 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl"
                  >
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Playback Speed</h3>
                    <div className="space-y-1">
                      {[0.5, 1, 1.25, 1.5, 2].map(speed => (
                        <button
                          key={speed}
                          onClick={() => changeSpeed(speed)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                        >
                          <span className="text-white">{speed === 1 ? 'Normal' : `${speed}x`}</span>
                          {playbackSpeed === speed && <Check size={16} className="text-primary" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={toggleFullscreen}
              className="text-white/70 hover:text-white transition-colors hover:scale-110"
            >
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InflucinePlayer;
