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
  ArrowLeft,
  Sparkles,
  PictureInPicture,
  Maximize2
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import Focusable from './Focusable';

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
}

interface ExtendedAudioTrack {
  id?: string;
  label: string;
  language: string;
  kind: string;
  enabled: boolean;
}

interface ExtendedAudioTrackList {
  length: number;
  [index: number]: ExtendedAudioTrack;
}

interface SubtitleFile {
  url: string;
  lang: string;
  label: string;
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
  isPip = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const iframeRef = useRef<HTMLIFrameElement | any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [adblockPath, setAdblockPath] = useState<string>('');

  useEffect(() => {
    // Get adblock script path
    window.ipcRenderer.invoke('get-adblock-path').then(setAdblockPath).catch(() => {});
  }, []);

  // Fetch External Subtitles
  useEffect(() => {
    if (src && src.startsWith('trailer://')) {
      // Extract video ID from trailer://VIDEO_ID.mp4
      const videoId = src.replace('trailer://', '').replace('.mp4', '');
      window.ipcRenderer.invoke('get-subtitles', videoId)
        .then((subs: SubtitleFile[]) => {
          setExternalSubtitles(subs);
        })
        .catch(() => setExternalSubtitles([]));
    } else {
      setExternalSubtitles([]);
    }
  }, [src]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      // console.log('InflucinePlayer mounted with:', { src, embedSrc, title });
    }
  }, [src, embedSrc, title]);
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
  const [forceEmbed, setForceEmbed] = useState(false);

  const isEmbed = forceEmbed || (!!embedSrc && !src);
  
  // Audio State
  const [audioMode, setAudioMode] = useState<'cinema' | 'standard'>('cinema');
  const [audioFormat, setAudioFormat] = useState<string>('Optimized Stereo');
  const [videoQuality, setVideoQuality] = useState<{ label: string, is4k: boolean, isHdr: boolean }>({ label: 'HD', is4k: false, isHdr: false });
  const [activeTab, setActiveTab] = useState<'speed' | 'audio' | 'subtitles'>('audio');
  const [availableTracks, setAvailableTracks] = useState<ExtendedAudioTrack[]>([]);

  useEffect(() => {
    if (isEmbed) {
      setActiveTab('speed');
    }
  }, [isEmbed]);
  const [availableSubtitles, setAvailableSubtitles] = useState<TextTrack[]>([]);
  const [externalSubtitles, setExternalSubtitles] = useState<SubtitleFile[]>([]);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(-1); // -1 = Off
  const [audioEngineReady, setAudioEngineReady] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  const { themeColor, subtitleSize, subtitleColor, updateSettings } = useSettings();
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize Audio Context (Cinema Audio)
  useEffect(() => {
    // DO NOT init audio context if we are in embed mode or if src is missing
    if (isEmbed || !videoRef.current || !src) return;

    // Additional check: If src is cross-origin and not CORS-enabled, skip to avoid "outputs zeroes" error
    // For now, we assume Archive.org might fail this, so we wrap in try/catch aggressively
    
    try {
      // Check if context already exists
      if (audioCtxRef.current) return;

      // Create Audio Context
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      // Create Nodes
      // Note: This requires crossOrigin="anonymous" on video element if src is cross-origin
      const source = ctx.createMediaElementSource(videoRef.current);
      const compressor = ctx.createDynamicsCompressor();

      // Configure Compressor for "Cinema Audio" (Loudness Normalization)
      // Goal: Boost quiet dialog, tame loud explosions, keep consistent volume
      compressor.threshold.value = -24; // Start compressing at -24dB
      compressor.knee.value = 30;       // Soft knee
      compressor.ratio.value = 12;      // High ratio for normalization
      compressor.attack.value = 0.003;  // Fast attack
      compressor.release.value = 0.25;  // Moderate release

      // Connect Graph: Source -> Compressor -> Destination
      source.connect(compressor);
      compressor.connect(ctx.destination);

      audioCtxRef.current = ctx;
      sourceNodeRef.current = source;
      compressorRef.current = compressor;

      setAudioEngineReady(true);
    } catch {
      // console.warn('[Influcine Audio] Failed to init Web Audio API (likely CORS):', e);
      // Fallback gracefully
      setAudioMode('standard');
      setAudioFormat('Standard Stereo');
      setAudioEngineReady(false);
    }
  }, [src, isEmbed]);

  // Sync textTracks when they change (e.g. external subtitles loaded)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isEmbed) return;

    const updateSubtitles = () => {
      const subs: TextTrack[] = [];
      let activeIndex = -1;
      if (video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          const track = video.textTracks[i];
          subs.push(track);
          if (track.mode === 'showing') {
            activeIndex = i;
          }
        }
      }
      setAvailableSubtitles(subs);
      setActiveSubtitleIndex(activeIndex);
    };

    // Initial check
    updateSubtitles();

    // Listen for changes
    const tracks = video.textTracks;
    if (tracks) {
      tracks.addEventListener('addtrack', updateSubtitles);
      tracks.addEventListener('removetrack', updateSubtitles);
      tracks.addEventListener('change', updateSubtitles);
      
      return () => {
        tracks.removeEventListener('addtrack', updateSubtitles);
        tracks.removeEventListener('removetrack', updateSubtitles);
        tracks.removeEventListener('change', updateSubtitles);
      };
    }
  }, [isEmbed, externalSubtitles]); // Re-run when external subtitles might have caused a DOM update

  // Handle Audio Mode Switching
  useEffect(() => {
    if (isEmbed || !sourceNodeRef.current || !compressorRef.current || !audioCtxRef.current) return;

    // Disconnect everything first
    sourceNodeRef.current.disconnect();
    compressorRef.current.disconnect();

    if (audioMode === 'cinema') {
      // Path: Source -> Compressor -> Destination
      sourceNodeRef.current.connect(compressorRef.current);
      compressorRef.current.connect(audioCtxRef.current.destination);
    } else {
      // Path: Source -> Destination (Passthrough)
      sourceNodeRef.current.connect(audioCtxRef.current.destination);
    }
  }, [audioMode, isEmbed]);

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
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Playback started successfully
              setIsPlaying(true);
            })
            .catch(error => {
              // Auto-play was prevented or interrupted
              if (error.name !== 'AbortError') {
                 // console.warn('[InflucinePlayer] Playback prevented:', error);
              }
              setIsPlaying(false);
            });
        }
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isEmbed, isPlaying]);

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
        // Try common embed player commands
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEmbed && !videoRef.current) return;

      switch(e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (isEmbed) {
            iframeRef.current?.contentWindow?.postMessage({ command: 'seek', time: currentTime + 10 }, '*');
          } else if (videoRef.current) {
            videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, videoRef.current.duration);
          }
          break;
        case 'ArrowLeft':
          if (isEmbed) {
            iframeRef.current?.contentWindow?.postMessage({ command: 'seek', time: Math.max(0, currentTime - 10) }, '*');
          } else if (videoRef.current) {
            videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
          }
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
  }, [volume, togglePlay, toggleFullscreen, toggleMute, handleVolumeChange, isEmbed, currentTime]);

  const handleTimeUpdate = () => {
    if (isEmbed) return;
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (onTimeUpdate) {
        onTimeUpdate(videoRef.current.currentTime, videoRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (isEmbed) return;
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      
      // Detect Audio & Video Capabilities
      const detectCapabilities = async () => {
        if (!videoRef.current) return;

        // --- Video Quality Detection ---
        const width = videoRef.current.videoWidth;
        const height = videoRef.current.videoHeight;
        const is4k = width >= 3840 || height >= 2160;
        
        // HDR Detection
        const isHdr = window.matchMedia('(dynamic-range: high)').matches || 
                      window.matchMedia('(color-gamut: p3)').matches || 
                      window.matchMedia('(color-gamut: rec2020)').matches;

        setVideoQuality({
          label: is4k ? '4K Ultra HD' : (height >= 1080 ? 'Full HD' : 'HD'),
          is4k,
          isHdr
        });

        // --- Audio Detection ---
        let detectedFormat = 'Optimized Stereo';
        let recommendedMode: 'cinema' | 'standard' = 'cinema';

        // 1. Check video tracks (Electron/Chrome)
        const videoEl = videoRef.current as unknown as { audioTracks?: ExtendedAudioTrackList };
        const audioTracks = videoEl.audioTracks;

        if (audioTracks && audioTracks.length > 0) {
           // console.log('[Influcine Audio] Tracks detected:', audioTracks);
           
           // Populate available tracks state
           const tracks: ExtendedAudioTrack[] = [];
           for (let i = 0; i < audioTracks.length; i++) {
             tracks.push(audioTracks[i]);
           }
           setAvailableTracks(tracks);

           // Analyze first track for hints
           const firstTrack = audioTracks[0];
           if (firstTrack?.label) {
             const label = firstTrack.label.toLowerCase();
             if (label.includes('atmos')) {
               detectedFormat = 'Dolby Atmos';
               recommendedMode = 'standard'; // Passthrough for Atmos
             } else if (label.includes('5.1') || label.includes('surround') || label.includes('ac3') || label.includes('dts')) {
               detectedFormat = 'Surround 5.1';
               recommendedMode = 'standard'; // Passthrough for Surround
             }
           }
        }

        // 1.1 Check Subtitle Tracks
        const currentVideo = videoRef.current;
        if (currentVideo?.textTracks && currentVideo.textTracks.length > 0) {
           const subs: TextTrack[] = [];
           let activeIndex = -1;
           for (let i = 0; i < currentVideo.textTracks.length; i++) {
             const track = currentVideo.textTracks[i];
             subs.push(track);
             if (track.mode === 'showing') {
               activeIndex = i;
             }
           }
           setAvailableSubtitles(subs);
           setActiveSubtitleIndex(activeIndex);
        }

        // 2. Check Media Capabilities (Spatial Audio Confirmation)
        if (navigator.mediaCapabilities) {
          try {
            // Check for Spatial Audio / Atmos support
            const config: MediaDecodingConfiguration = {
              type: 'file',
              audio: {
                contentType: 'audio/mp4; codecs="mp4a.40.2"', // Standard AAC check
                spatialRendering: true
              }
            };
            const info = await navigator.mediaCapabilities.decodingInfo(config);
            if (info.supported && info.keySystemAccess === null) {
              // Device supports spatial rendering
              // If we haven't already detected a specific format, we might hint at spatial support
              if (detectedFormat === 'Optimized Stereo') {
                 // We don't upgrade to Atmos blindly, but we acknowledge the capability
              }
            }
          } catch {
            // console.debug('[Influcine Audio] Capability check failed', e);
          }
        }

        // 3. Channel Count Check (Web Audio API)
        if (audioCtxRef.current) {
          const dest = audioCtxRef.current.destination;
          // If the output device supports > 2 channels, and we haven't detected specific tracks,
          // we might be in a position to upmix or at least allow passthrough.
          if (dest.maxChannelCount >= 6 && detectedFormat === 'Optimized Stereo') {
             // detectedFormat = 'Surround 5.1 (System)'; 
             // We keep it as Stereo unless the SOURCE is confirmed Surround, 
             // but we might allow Standard mode to let the OS upmix if it wants.
          }
        }

        setAudioFormat(detectedFormat);
        
        // Apply logic: "Passes through spatial/surround audio when supported"
        // If we detected surround/atmos, switch to standard to avoid Web Audio downmixing
        if (recommendedMode === 'standard') {
          setAudioMode('standard');
        }
      };
      
      detectCapabilities();
    }
  };

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

  const switchAudioTrack = useCallback((trackToSelect: ExtendedAudioTrack) => {
    if (isEmbed) return;
    const videoEl = videoRef.current as unknown as { audioTracks?: ExtendedAudioTrackList };
    if (videoEl?.audioTracks) {
       for (let i = 0; i < videoEl.audioTracks.length; i++) {
         const track = videoEl.audioTracks[i];
         track.enabled = track === trackToSelect;
       }
       // Update state to reflect changes
       const newTracks: ExtendedAudioTrack[] = [];
       for (let i = 0; i < videoEl.audioTracks.length; i++) {
         newTracks.push(videoEl.audioTracks[i]);
       }
       setAvailableTracks(newTracks);
    }
  }, [isEmbed]);

  const switchSubtitleTrack = useCallback((index: number) => {
    if (isEmbed) return;
    if (videoRef.current?.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        const track = videoRef.current.textTracks[i];
        track.mode = i === index ? 'showing' : 'hidden';
      }
      setActiveSubtitleIndex(index);
    }
  }, [isEmbed]);

  const getSubtitleStyles = () => {
    const sizes = {
      small: '1.25rem', // 20px
      medium: '1.75rem', // 28px
      large: '2.5rem' // 40px
    };
    const colors = {
      white: '#ffffff',
      yellow: '#facc15',
      cyan: '#22d3ee'
    };

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

  useEffect(() => {
    if (!isEmbed) return;
    const origins = [
      'https://vidfast.pro',
      'https://vidfast.org',
      'https://vidfast.net',
      'https://vidfast.to',
      'https://vidfast.io',
      'https://vidfast.co',
      'https://vidfast.me',
      'https://vidfast.cloud',
      'https://vidfast.cc',
      'https://vidfast.info',
      'https://vidlink.pro',
      'https://vidlink.io',
      'https://vidlink.to',
      'https://vidlink.net',
    ];

    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (origins.length && !origins.includes(event.origin)) return;

      if (event.data.type === 'PLAYER_EVENT') {
        const { event: playerEvent, currentTime: ct, duration: dur } = event.data.data || {};

        // Optimize: Only update state if we are NOT in embed mode (since UI is hidden)
        // This prevents excessive re-renders during playback
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

  // Block popups from the webview in the renderer process as an extra layer of defense
  useEffect(() => {
    const webview = iframeRef.current;
    if (!webview || !isEmbed) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleNewWindow = (e: any) => {
      // console.warn('Blocked renderer webview popup:', e.url);
      e.preventDefault();
    };


    // 'new-window' is the event for webview tag
    webview.addEventListener('new-window', handleNewWindow);
    return () => webview.removeEventListener('new-window', handleNewWindow);
  }, [isEmbed]);

  const handleVideoError = () => {
    // console.error('Native playback error. Switching to embed if available.');
    if (embedSrc) {
      setForceEmbed(true);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black group overflow-hidden font-sans select-none"
      onDoubleClick={toggleFullscreen}
    >
      {isEmbed ? (
        <webview
          ref={iframeRef}
          src={embedSrc}
          className="w-full h-full border-0"
          preload={`file://${adblockPath}`}
          webpreferences="contextIsolation=true, nodeIntegration=false"
          useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          allowpopups="false"
        />
      ) : (
        <video
          ref={videoRef}
          src={src}
          crossOrigin="anonymous"
          poster={poster}
          className="w-full h-full object-contain"
          controls={false}
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleVideoError}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            onPlay?.();
          }}
          onPause={onPause}
          onEnded={onEnded}
        >
          {externalSubtitles.map((sub, index) => (
            <track
              key={sub.url}
              kind="subtitles"
              src={sub.url}
              srcLang={sub.lang}
              label={sub.label}
              default={index === 0}
            />
          ))}
        </video>
      )}

      {/* Loading Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-16 h-16 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Top Gradient */}
      {!isPip && (
      <div className={`absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-black/80 to-transparent transition-opacity duration-300 z-20 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <div className="p-6 flex items-center gap-4">
          {onBack && (
            <Focusable 
              as="button"
              onClick={onBack}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all hover:scale-110"
              activeClassName="ring-2 ring-primary scale-110 bg-primary"
            >
              <ArrowLeft size={24} />
            </Focusable>
          )}
          
          <div className="flex flex-col flex-1 min-w-0 mr-4">
            <h1 className="text-xl font-bold text-white drop-shadow-md leading-tight truncate">{title}</h1>
            <div className="flex items-center gap-2 mt-1 overflow-x-auto scrollbar-hide">
              {videoQuality.is4k && (
                <div className="px-1.5 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/50 text-yellow-500 text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm shadow-[0_0_10px_rgba(234,179,8,0.2)] shrink-0">
                  4K ULTRA HD
                </div>
              )}
              {videoQuality.isHdr && (
                 <div className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white/90 text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm shrink-0">
                  HDR
                </div>
              )}
              {!videoQuality.is4k && (
                 <div className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-white/60 text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm shrink-0">
                  {videoQuality.label}
                </div>
              )}
              {audioFormat.includes('Atmos') && (
                 <div className="px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/50 text-blue-400 text-[10px] font-bold tracking-wider uppercase backdrop-blur-sm shrink-0">
                  ATMOS
                </div>
              )}
            </div>
          </div>
          
          {onNext && (
            <Focusable 
              as="button"
              onClick={onNext}
              className="ml-auto px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-bold text-sm transition-colors"
              activeClassName="ring-2 ring-white scale-105"
            >
              Next Episode
            </Focusable>
          )}
        </div>
      </div>
      )}

      {/* Bottom Gradient to occlude underlying native/embed controls */}
      {!isPip && (
      <div className={`absolute bottom-0 left-0 right-0 h-40 bg-linear-to-t from-black/80 to-transparent transition-opacity duration-300 z-20 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`} />
      )}

      {/* Dynamic Subtitle Styles */}
      {!isEmbed && <style>{getSubtitleStyles()}</style>}

      {/* Main Controls Container - Only show for native playback */}
      {!isEmbed && !isPip && (
      <div className={`absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 z-30 pointer-events-none ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        
        {/* Progress Bar */}
        <div className="group/progress relative h-2 mb-4 cursor-pointer pointer-events-auto">
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
          <div className="flex items-center gap-4 pointer-events-auto">
            <Focusable 
              as="button"
              onClick={togglePlay}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all hover:scale-110"
              activeClassName="ring-2 ring-primary scale-110 bg-primary"
              autoFocus
            >
              {isPlaying ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} className="ml-1" />}
            </Focusable>

            <Focusable as="button" onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }} className="text-white/70 hover:text-white transition-colors" activeClassName="text-white scale-125 ring-2 ring-white/50 rounded-full p-1">
              <SkipBack size={24} />
            </Focusable>
            <Focusable as="button" onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }} className="text-white/70 hover:text-white transition-colors" activeClassName="text-white scale-125 ring-2 ring-white/50 rounded-full p-1">
              <SkipForward size={24} />
            </Focusable>

            {!isEmbed && (<div className="group/volume flex items-center gap-2 ml-2">
              <Focusable as="button" onClick={toggleMute} className="text-white hover:text-primary transition-colors" activeClassName="text-primary scale-125 ring-2 ring-primary/50 rounded-full p-1">
                {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </Focusable>
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
            </div>)}

            <span className="text-sm font-medium text-white/80 tabular-nums tracking-wider">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Settings Menu */}
            <div className="relative">
              <Focusable 
                as="button"
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full transition-all ${showSettings ? 'bg-white/20 rotate-90 text-white' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
                activeClassName="ring-2 ring-primary bg-white/20 text-white"
              >
                <Settings size={24} />
              </Focusable>
              
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="absolute bottom-14 right-0 w-72 bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                  >
                    {/* Header Tabs */}
                    <div className="flex border-b border-white/10">
                      <button 
                        onClick={() => setActiveTab('audio')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'audio' ? 'text-primary bg-white/5' : 'text-gray-400 hover:text-white'}`}
                      >
                        Audio
                      </button>
                      <button 
                        onClick={() => setActiveTab('subtitles')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'subtitles' ? 'text-primary bg-white/5' : 'text-gray-400 hover:text-white'}`}
                      >
                        Subs
                      </button>
                      <button 
                        onClick={() => setActiveTab('speed')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'speed' ? 'text-primary bg-white/5' : 'text-gray-400 hover:text-white'}`}
                      >
                        Speed
                      </button>
                    </div>

                    <div className="p-2 max-h-80 overflow-y-auto">
                      {activeTab === 'audio' ? (
                        <div className="space-y-1">
                           <div className="px-3 py-2">
                             <div className="text-xs text-gray-400 font-medium mb-1">Detected Format</div>
                             <div className="flex items-center gap-2 text-white font-bold text-sm">
                               <Sparkles size={14} className="text-primary" />
                               {audioFormat}
                             </div>
                           </div>
                           
                           <div className="h-px bg-white/10 my-2" />

                           {availableTracks.length > 1 && (
                             <div className="mb-2">
                               <div className="px-3 py-1 text-xs text-gray-400 font-medium">Audio Track</div>
                               {availableTracks.map((track, i) => (
                                 <Focusable
                                  as="button"
                                  key={i}
                                  onClick={() => switchAudioTrack(track)}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${track.enabled ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400'}`}
                                 >
                                   <div className="text-sm font-medium truncate pr-2">{track.label || `Track ${i + 1}`}</div>
                                   {track.enabled && <Check size={14} className="text-primary" />}
                                 </Focusable>
                               ))}
                               <div className="h-px bg-white/10 my-2" />
                             </div>
                           )}

                           <Focusable
                            as="button"
                            onClick={() => audioEngineReady && setAudioMode('cinema')}
                            disabled={!audioEngineReady}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all ${
                              !audioEngineReady 
                                ? 'opacity-50 cursor-not-allowed bg-white/5' 
                                : audioMode === 'cinema' 
                                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                  : 'hover:bg-white/10 text-gray-300'
                            }`}
                           >
                             <div className="text-left">
                               <div className="font-bold text-sm">Cinema Audio</div>
                               <div className="text-[10px] opacity-80">
                                 {audioEngineReady ? 'Dynamic Loudness & Clarity' : 'Unavailable (CORS Restricted)'}
                               </div>
                             </div>
                             {audioMode === 'cinema' && audioEngineReady && <Check size={16} />}
                           </Focusable>

                           <Focusable
                            as="button"
                            onClick={() => setAudioMode('standard')}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all ${audioMode === 'standard' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-300'}`}
                           >
                             <div className="text-left">
                               <div className="font-bold text-sm">Standard</div>
                               <div className="text-[10px] opacity-80">Passthrough / Unprocessed</div>
                             </div>
                             {audioMode === 'standard' && <Check size={16} />}
                           </Focusable>
                        </div>
                      ) : activeTab === 'subtitles' && !isEmbed ? (
                        <div className="space-y-4 p-1">
                          {/* Track Selection */}
                          <div>
                            <div className="px-2 pb-2 text-xs text-gray-400 font-medium">Track</div>
                            <div className="space-y-1">
                              <Focusable
                                as="button"
                                onClick={() => switchSubtitleTrack(-1)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${activeSubtitleIndex === -1 ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400'}`}
                              >
                                <div className="text-sm font-medium">Off</div>
                                {activeSubtitleIndex === -1 && <Check size={14} className="text-primary" />}
                              </Focusable>
                              
                              {availableSubtitles.map((track, i) => (
                                <Focusable
                                  as="button"
                                  key={i}
                                  onClick={() => switchSubtitleTrack(i)}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${activeSubtitleIndex === i ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400'}`}
                                >
                                  <div className="text-sm font-medium">{track.label || `Subtitle ${i + 1}`}</div>
                                  {activeSubtitleIndex === i && <Check size={14} className="text-primary" />}
                                </Focusable>
                              ))}
                            </div>
                          </div>

                          <div className="h-px bg-white/10" />

                          {/* Style Settings */}
                          <div>
                            <div className="px-2 pb-2 text-xs text-gray-400 font-medium">Appearance</div>
                            
                              {/* Size */}
                            <div className="mb-3">
                              <div className="text-[10px] text-gray-500 mb-1 px-2">Size</div>
                              <div className="flex bg-white/5 rounded-lg p-1">
                                {(['small', 'medium', 'large'] as const).map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => updateSettings({ subtitleSize: s })}
                                    className={`flex-1 py-1 text-xs font-medium rounded transition-all ${subtitleSize === s ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                                  >
                                    {s.charAt(0).toUpperCase() + s.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Color */}
                            <div>
                              <div className="text-[10px] text-gray-500 mb-1 px-2">Color</div>
                              <div className="flex gap-2 px-2">
                                {(['white', 'yellow', 'cyan'] as const).map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => updateSettings({ subtitleColor: c })}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${subtitleColor === c ? 'border-primary scale-110' : 'border-transparent hover:scale-105'}`}
                                    style={{ backgroundColor: c === 'white' ? '#ffffff' : c === 'yellow' ? '#facc15' : '#22d3ee' }}
                                    aria-label={c}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {[0.5, 1, 1.25, 1.5, 2].map(speed => (
                            <Focusable
                              as="button"
                              key={speed}
                              onClick={() => changeSpeed(speed)}
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                              activeClassName="bg-primary text-white"
                            >
                              <span className="text-white">{speed === 1 ? 'Normal' : `${speed}x`}</span>
                              {playbackSpeed === speed && <Check size={16} className="text-primary" />}
                            </Focusable>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {onPipToggle && (
              <Focusable 
                as="button"
                onClick={onPipToggle}
                className="text-white/70 hover:text-white transition-colors hover:scale-110 cursor-pointer pointer-events-auto"
                activeClassName="text-white scale-125 ring-2 ring-white/50 rounded-full p-1"
                title={isPip ? "Maximize" : "Picture in Picture"}
              >
                {isPip ? <Maximize2 size={24} /> : <PictureInPicture size={24} />}
              </Focusable>
            )}

            {!isPip && (
            <Focusable 
              as="button"
              onClick={toggleFullscreen}
              className="text-white/70 hover:text-white transition-colors hover:scale-110 cursor-pointer pointer-events-auto"
              activeClassName="text-white scale-125 ring-2 ring-white/50 rounded-full p-1"
            >
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </Focusable>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default InflucinePlayer;
