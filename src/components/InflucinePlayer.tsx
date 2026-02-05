import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { SubtitleOverlay } from './SubtitleOverlay';
import { parseSubtitle } from '../utils/subtitleParser';

// Hooks
import { usePlayerAudio } from '../hooks/usePlayerAudio';
import { usePlayerSubtitles } from '../hooks/usePlayerSubtitles';

// Components
import { PlayerHeader } from './player/PlayerHeader';
import { PlayerControls } from './player/PlayerControls';
import { PlayerOverlay } from './player/PlayerOverlay';
import { PlayerSettings } from './player/PlayerSettings';

interface InflucinePlayerProps {
  src?: string;
  embedSrc?: string;
  poster?: string;
  title?: string;
  onBack?: () => void;
  onNext?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  startTime?: number;
  onPipToggle?: () => void;
  isPip?: boolean;
  mediaData?: {
    tmdbId?: string;
    imdbId?: string;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
  };
}

const InflucinePlayer: React.FC<InflucinePlayerProps> = ({ 
  src, 
  embedSrc,
  poster, 
  title, 
  onBack, 
  onNext, 
  onTimeUpdate,
  onPlay,
  onPause,
  onEnded,
  startTime = 0,
  onPipToggle,
  isPip = false,
  mediaData
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iframeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [adblockPath, setAdblockPath] = useState<string>('');
  const [forceEmbed, setForceEmbed] = useState(false);
  const isEmbed = forceEmbed || (!!embedSrc && !src);

  useEffect(() => {
    window.ipcRenderer.invoke('get-adblock-path').then(setAdblockPath).catch(() => {});
  }, []);

  // --- Player State ---
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
  const [hasResumed, setHasResumed] = useState(false);
  
  // Settings Tab State
  const [activeTab, setActiveTab] = useState<'speed' | 'audio' | 'subtitles'>('audio');
  useEffect(() => {
    if (isEmbed) setActiveTab('speed');
  }, [isEmbed]);

  // --- Hooks ---
  const {
    audioMode, setAudioMode,
    audioFormat,
    audioEngineReady, resumeAudioContext,
    availableTracks, detectAudioCapabilities, switchAudioTrack
  } = usePlayerAudio(videoRef, isEmbed, src);

  const {
    availableSubtitles, externalSubtitles,
    activeSubtitleIndex, setActiveSubtitleIndex,
    customSubtitles, setCustomSubtitles,
    embedTracks, setEmbedTracks,
    activeEmbedTrackIndex, setActiveEmbedTrackIndex,
    autoSubtitles, activeAutoSubtitleIndex, loadAutoSubtitle,
    isSearchingSubs
  } = usePlayerSubtitles(videoRef, isEmbed, mediaData, src);

  const { themeColor, subtitleSize, subtitleColor } = useSettings();

  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // --- Logic ---

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
    if (!isEmbed && videoRef.current) {
      videoRef.current.currentTime = startTime;
      setVolume(videoRef.current.volume);
    }
  }, [startTime, isEmbed]);

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
    if (isEmbed) {
      if (iframeRef.current?.send) {
        iframeRef.current.send('player-command', { command: isPlaying ? 'pause' : 'play' });
        setIsPlaying(!isPlaying);
      } else {
        const win = iframeRef.current?.contentWindow;
        if (win) {
          win.postMessage({ command: isPlaying ? 'pause' : 'play' }, '*');
          setIsPlaying(!isPlaying);
        }
      }
      return;
    }
    if (videoRef.current) {
      if (videoRef.current.paused) {
        resumeAudioContext();
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        }
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isEmbed, isPlaying, resumeAudioContext]);

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
    if (isEmbed) {
      setIsMuted(newVolume === 0);
      return;
    }
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  }, [isEmbed]);

  const toggleMute = useCallback(() => {
    if (isEmbed) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      setVolume(newMuted ? 0 : 1);
      return;
    }
    if (videoRef.current) {
      const newMuted = !videoRef.current.muted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  }, [isEmbed, isMuted]);

  const changeSpeed = useCallback((speed: number) => {
    if (isEmbed) {
      setPlaybackSpeed(speed);
      if (iframeRef.current?.send) {
        iframeRef.current.send('player-command', { command: 'setSpeed', speed });
        iframeRef.current.send('player-command', { command: 'ratechange', playbackRate: speed });
      } else if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ command: 'setSpeed', speed }, '*');
        iframeRef.current.contentWindow.postMessage({ command: 'ratechange', playbackRate: speed }, '*');
      }
      setShowSettings(false);
      return;
    }
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSettings(false);
    }
  }, [isEmbed]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (isEmbed) {
      if (iframeRef.current?.send) {
        iframeRef.current.send('player-command', { command: 'seek', time });
      } else {
        iframeRef.current?.contentWindow?.postMessage({ command: 'seek', time }, '*');
      }
      setCurrentTime(time);
      return;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (isEmbed) return;
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      detectAudioCapabilities();
    }
  };

  const switchSubtitleTrack = useCallback((index: number) => {
    if (isEmbed) return;
    if (videoRef.current?.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        const track = videoRef.current.textTracks[i];
        track.mode = i === index ? 'showing' : 'hidden';
      }
      setActiveSubtitleIndex(index);
    }
  }, [isEmbed, setActiveSubtitleIndex]);

  // Embed messaging logic
  useEffect(() => {
    if (!isEmbed) return;
    const origins = [
      'https://vidfast.pro', 'https://vidfast.org', 'https://vidfast.net',
      'https://vidfast.to', 'https://vidfast.io', 'https://vidfast.co',
      'https://vidfast.me', 'https://vidfast.cloud', 'https://vidfast.cc',
      'https://vidfast.info', 'https://vidlink.pro', 'https://vidlink.io',
      'https://vidlink.to', 'https://vidlink.net',
    ];

    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (origins.length && !origins.includes(event.origin)) return;

      if (event.data.type === 'PLAYER_EVENT') {
        const { event: playerEvent, currentTime: ct, duration: dur } = event.data.data || {};

        if (!isEmbed && typeof ct === 'number') {
            setCurrentTime(ct);
        }
        
        if (typeof dur === 'number') setDuration(dur);
        if (typeof ct === 'number' && typeof dur === 'number' && onTimeUpdate) {
          onTimeUpdate(ct, dur);
        }

        if (playerEvent === 'play') {
          setIsPlaying(true);
          onPlay?.();
          if (startTime > 0 && !hasResumed) {
            iframeRef.current?.contentWindow?.postMessage({ command: 'seek', time: startTime }, '*');
            setHasResumed(true);
          }
        }
        if (playerEvent === 'pause') {
          setIsPlaying(false);
          onPause?.();
        }
        if (playerEvent === 'ended') {
          setIsPlaying(false);
          onEnded?.();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isEmbed, onTimeUpdate, onPlay, onPause, onEnded, startTime, hasResumed]);

  // Embed IPC Listeners
  useEffect(() => {
    const handleTracks = (_: any, tracks: any[]) => {
        setEmbedTracks(tracks);
    };

    const handleCues = (_: any, data: {index: number, cues: any[]}) => {
        if (data.index === activeEmbedTrackIndex) {
            setCustomSubtitles(data.cues);
        }
    };

    if (window.ipcRenderer) {
        window.ipcRenderer.on('embed-tracks-found', handleTracks);
        window.ipcRenderer.on('embed-track-cues', handleCues);
    }
    return () => {
        if (window.ipcRenderer) {
            window.ipcRenderer.removeAllListeners('embed-tracks-found');
            window.ipcRenderer.removeAllListeners('embed-track-cues');
        }
    };
  }, [activeEmbedTrackIndex, setEmbedTracks, setCustomSubtitles]);

  const loadEmbedTrack = (index: number) => {
      if (index === -1) {
          setActiveEmbedTrackIndex(-1);
          setCustomSubtitles([]);
          return;
      }
      setActiveEmbedTrackIndex(index);
      setCustomSubtitles([]);
      try {
         iframeRef.current.send('get-embed-track-cues', index);
      } catch (e) {
         // console.error("Failed to send to webview", e);
      }
  };

  const handleSubtitleUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt,.vtt';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const text = await file.text();
            // We need parseSubtitle here, or we can move it to a util.
            // Since we imported usePlayerSubtitles, we don't have parseSubtitle exposed directly.
            // But we can just use the hook's setCustomSubtitles with a parsed value?
            // Wait, we need the parser. It was imported in usePlayerSubtitles.
            // We should export it from there or import it here.
            // I'll import it at top.
        }
    };
    input.click();
  };

  // Styles
  const getSubtitleStyles = () => {
    const sizes = { small: '1.25rem', medium: '1.75rem', large: '2.5rem' };
    const colors = { white: '#ffffff', yellow: '#facc15', cyan: '#22d3ee' };
    return `
      video::cue {
        font-size: ${sizes[subtitleSize] || sizes.medium};
        color: ${colors[subtitleColor] || colors.white};
        background-color: rgba(0, 0, 0, 0.6);
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
        border-radius: 4px;
      }
    `;
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black group overflow-hidden font-sans select-none"
      onDoubleClick={toggleFullscreen}
    >
      <style>{getSubtitleStyles()}</style>

      {isEmbed ? (
        <webview
          ref={iframeRef}
          src={embedSrc}
          className="w-full h-full border-0"
          preload={`file://${adblockPath}`}
          webpreferences="contextIsolation=true, nodeIntegration=false"
        />
      ) : (
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-contain"
          onTimeUpdate={() => {
              if(videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  onTimeUpdate?.(videoRef.current.currentTime, videoRef.current.duration);
              }
          }}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={() => {
              setIsPlaying(false);
              onEnded?.();
          }}
          crossOrigin="anonymous"
          poster={poster}
          playsInline
        />
      )}

      {/* Subtitle Overlay (Custom / Embed / Auto) */}
      <SubtitleOverlay 
        subtitles={customSubtitles} 
        currentTime={currentTime} 
        offset={0}
      />

      {/* Header */}
      <PlayerHeader 
        title={title} 
        onBack={onBack} 
        showControls={showControls} 
      />

      {/* Center Overlay */}
      <PlayerOverlay 
        isPlaying={isPlaying} 
        isBuffering={isBuffering} 
        onTogglePlay={togglePlay} 
      />

      {/* Controls */}
      <PlayerControls
        showControls={showControls}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onOpenSettings={() => setShowSettings(true)}
        isPip={isPip}
        onPipToggle={onPipToggle}
        onNext={onNext}
        formatTime={formatTime}
      />

      {/* Settings */}
      <PlayerSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        playbackSpeed={playbackSpeed}
        onSpeedChange={changeSpeed}
        audioMode={audioMode}
        onAudioModeChange={setAudioMode}
        audioFormat={audioFormat}
        availableTracks={availableTracks}
        onTrackChange={switchAudioTrack}
        availableSubtitles={availableSubtitles}
        externalSubtitles={externalSubtitles}
        activeSubtitleIndex={activeSubtitleIndex}
        onSubtitleChange={switchSubtitleTrack}
        embedTracks={embedTracks}
        activeEmbedTrackIndex={activeEmbedTrackIndex}
        onEmbedTrackChange={loadEmbedTrack}
        autoSubtitles={autoSubtitles}
        activeAutoSubtitleIndex={activeAutoSubtitleIndex}
        onAutoSubtitleChange={loadAutoSubtitle}
        isSearchingSubs={isSearchingSubs}
        onUploadClick={handleSubtitleUpload}
        onSearchOnline={() => {
             const query = title ? encodeURIComponent(title) : '';
             window.open(`https://www.opensubtitles.org/en/search/sublanguageid-all/moviename-${query}`, '_blank');
        }}
      />
    </div>
  );
};

export default InflucinePlayer;
