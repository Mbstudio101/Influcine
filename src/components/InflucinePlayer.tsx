import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { SubtitleOverlay } from './SubtitleOverlay';
import { errorAgent } from '../services/errorAgent';
import { SkipForward, X } from 'lucide-react';

// Hooks
import { ExtendedAudioTrack, usePlayerAudio } from '../hooks/usePlayerAudio';
import { usePlayerSubtitles } from '../hooks/usePlayerSubtitles';
import { useAuth } from '../context/useAuth';
import { getPreference, togglePreference } from '../services/recommendationEngine';

import { SubtitleCue, parseSubtitle } from '../utils/subtitleParser';
import { isTVActionKey } from '../utils/tvKeymap';

// Components
import { PlayerHeader } from './player/PlayerHeader';
import { PlayerControls } from './player/PlayerControls';
import { PlayerOverlay } from './player/PlayerOverlay';
import { PlayerSettings } from './player/PlayerSettings';
import { PlayerErrorBoundary } from './player/PlayerErrorBoundary';
import TitleBar from './TitleBar';

export interface VideoFilters {
  brightness: number; // 0.5 - 1.5, default 1
  contrast: number;   // 0.5 - 1.5, default 1
  saturation: number; // 0 - 2, default 1
}

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
  provider?: string;
  onProviderChange?: (provider: string) => void;
  mediaData?: {
    tmdbId?: string;
    imdbId?: string;
    type: 'movie' | 'tv';
    season?: number;
    episode?: number;
    audio_format?: 'atmos' | '5.1' | 'stereo';
  };
  upNext?: {
    season: number;
    episode: number;
    countdown: number;
  };
  onUpNextNow?: () => void;
  onUpNextDismiss?: () => void;
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
  provider,
  onProviderChange,
  mediaData,
  upNext,
  onUpNextNow,
  onUpNextDismiss
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isEmbed = !!embedSrc && !src;

  // --- Player State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  // --- User Preferences ---
  const { profile } = useAuth();
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);

  useEffect(() => {
    if (profile?.id && mediaData?.tmdbId) {
      getPreference(profile.id, parseInt(mediaData.tmdbId)).then(pref => {
        if (pref?.vote === 'like') setUserVote('like');
        else if (pref?.vote === 'dislike') setUserVote('dislike');
      });
    }
  }, [profile, mediaData?.tmdbId]);

  const handleVote = async (vote: 'like' | 'dislike') => {
    if (!profile?.id || !mediaData?.tmdbId) return;
    const tmdbId = parseInt(mediaData.tmdbId);

    // Optimistic
    if (userVote === vote) {
        setUserVote(null);
        await togglePreference(profile.id, tmdbId, vote, mediaData.type || 'movie');
    } else {
        setUserVote(vote);
        await togglePreference(profile.id, tmdbId, vote, mediaData.type || 'movie');
    }
  };
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hasResumed, setHasResumed] = useState(false);
  const [internalPip, setInternalPip] = useState(false);
  const [isNativeMode, setIsNativeMode] = useState(true); // Default to true
  const [embedAudioTracks, setEmbedAudioTracks] = useState<ExtendedAudioTrack[]>([]);

  // Video Filters
  const [videoFilters, setVideoFilters] = useState<VideoFilters>({ brightness: 1, contrast: 1, saturation: 1 });

  // Sleep Timer
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerEnd, setSleepTimerEnd] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<string | null>(null);

  const startSleepTimer = useCallback((minutes: number) => {
    const end = Date.now() + minutes * 60 * 1000;
    setSleepTimerMinutes(minutes);
    setSleepTimerEnd(end);
  }, []);

  const cancelSleepTimer = useCallback(() => {
    setSleepTimerMinutes(null);
    setSleepTimerEnd(null);
    setSleepTimerRemaining(null);
  }, []);

  useEffect(() => {
    if (!sleepTimerEnd) return;
    const interval = setInterval(() => {
      const remaining = sleepTimerEnd - Date.now();
      if (remaining <= 0) {
        // Timer expired — pause playback
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
        cancelSleepTimer();
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setSleepTimerRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerEnd, cancelSleepTimer]);

  // Settings Tab State
  const [activeTab, setActiveTab] = useState<'speed' | 'audio' | 'subtitles' | 'source' | 'video'>('audio');
  useEffect(() => {
    if (isEmbed) setActiveTab('source');
  }, [isEmbed]);

  useEffect(() => {
    if (isEmbed && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({
          command: isNativeMode ? 'showNativeControls' : 'hideNativeControls'
        }, '*');
      } catch {
        // iframe not ready yet
      }
    }
  }, [isEmbed, isNativeMode]);

  const toggleNativeMode = useCallback(() => {
      if (!isEmbed) return;
      
      const newMode = !isNativeMode;
      setIsNativeMode(newMode);
      
      if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
              command: newMode ? 'showNativeControls' : 'hideNativeControls'
          }, '*');
      }
      setShowSettings(false);
  }, [isEmbed, isNativeMode]);

  // --- Hooks ---
  const {
    audioMode, setAudioMode,
    audioFormat,
    resumeAudioContext,
    availableTracks, detectAudioCapabilities, switchAudioTrack,
    setVolume: setAudioGain,
    analyserNode
  } = usePlayerAudio(videoRef, isEmbed, src);

  const {
    availableSubtitles, externalSubtitles,
    activeSubtitleIndex, setActiveSubtitleIndex,
    customSubtitles, setCustomSubtitles,
    embedTracks, setEmbedTracks,
    activeEmbedTrackIndex, setActiveEmbedTrackIndex,
    autoSubtitles, activeAutoSubtitleIndex, setActiveAutoSubtitleIndex, loadAutoSubtitle,
    isSearchingSubs
  } = usePlayerSubtitles(videoRef, isEmbed, mediaData, src);

  const effectiveAudioTracks = React.useMemo(() => {
    if (!isEmbed) return availableTracks;
    if (embedAudioTracks.length > 0) return embedAudioTracks;
    return availableTracks;
  }, [isEmbed, availableTracks, embedAudioTracks]);

  const subtitleOptionsCount =
    availableSubtitles.length + externalSubtitles.length + embedTracks.length + autoSubtitles.length;
  const hasSubtitleOptions = subtitleOptionsCount > 0;
  const hasDubOptions = (() => {
    const tracks = effectiveAudioTracks;
    if (tracks.length > 1) return true;
    return tracks.some((track) => {
      const value = `${track.label || ''} ${track.language || ''}`.toLowerCase();
      return value.includes('dub') || value.includes('english') || value.includes('multi');
    });
  })();

  const { subtitleSize, subtitleColor } = useSettings();

  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const isPlayingRef = useRef(false);
  const pendingPlayPauseRetryRef = useRef<number | null>(null);
  const pendingPlayPauseTargetRef = useRef<'play' | 'pause' | null>(null);
  const lastDesyncLogAtRef = useRef(0);

  // --- Logic ---

  const formatTime = useCallback((time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Initialize
  useEffect(() => {
    if (!isEmbed && videoRef.current) {
      videoRef.current.currentTime = startTime;
      setVolume(videoRef.current.volume);

      const video = videoRef.current;
      const onEnterPip = () => setInternalPip(true);
      const onLeavePip = () => setInternalPip(false);
  
      video.addEventListener('enterpictureinpicture', onEnterPip);
      video.addEventListener('leavepictureinpicture', onLeavePip);
  
      return () => {
          video.removeEventListener('enterpictureinpicture', onEnterPip);
          video.removeEventListener('leavepictureinpicture', onLeavePip);
      };
    }
  }, [startTime, isEmbed]);

  // Handle controls visibility
  useEffect(() => {
    let lastActivity = 0;
    const THROTTLE_MS = 200;

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity < THROTTLE_MS) return;
      lastActivity = now;

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
      container.addEventListener('keydown', handleActivity);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleActivity);
        container.removeEventListener('click', handleActivity);
        container.removeEventListener('keydown', handleActivity);
      }
      clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  const sendEmbedPlayPauseCommand = useCallback((command: 'play' | 'pause') => {
    try {
      iframeRef.current?.contentWindow?.postMessage({ command }, '*');
    } catch (e) {
      errorAgent.log({
        message: 'Failed to send embed play/pause command',
        type: 'WARN',
        context: { command, error: String(e) },
      });
    }
  }, []);

  const clearPendingPlayPauseRetry = useCallback(() => {
    if (pendingPlayPauseRetryRef.current) {
      window.clearTimeout(pendingPlayPauseRetryRef.current);
      pendingPlayPauseRetryRef.current = null;
    }
    pendingPlayPauseTargetRef.current = null;
  }, []);

  const togglePlay = useCallback(() => {
    if (isEmbed) {
      const target: 'play' | 'pause' = isPlayingRef.current ? 'pause' : 'play';
      pendingPlayPauseTargetRef.current = target;
      setIsPlaying(target === 'play');
      sendEmbedPlayPauseCommand(target);

      if (pendingPlayPauseRetryRef.current) {
        window.clearTimeout(pendingPlayPauseRetryRef.current);
      }

      pendingPlayPauseRetryRef.current = window.setTimeout(() => {
        const isSynced =
          (target === 'pause' && !isPlayingRef.current) ||
          (target === 'play' && isPlayingRef.current);

        if (!isSynced) {
          sendEmbedPlayPauseCommand(target);
          pendingPlayPauseRetryRef.current = window.setTimeout(() => {
            const syncedAfterRetry =
              (target === 'pause' && !isPlayingRef.current) ||
              (target === 'play' && isPlayingRef.current);
            if (!syncedAfterRetry) {
              const now = Date.now();
              if (now - lastDesyncLogAtRef.current > 30000) {
                lastDesyncLogAtRef.current = now;
                errorAgent.log({
                  message: 'Embed play/pause state desync detected',
                  type: 'INFO',
                  context: { target, isPlaying: isPlayingRef.current, title, provider },
                });
              }
            }
            clearPendingPlayPauseRetry();
          }, 450);
          return;
        }
        clearPendingPlayPauseRetry();
      }, 380);
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
  }, [isEmbed, resumeAudioContext, sendEmbedPlayPauseCommand, clearPendingPlayPauseRetry, title, provider]);

  useEffect(() => {
    const handleRemoteToggle = () => {
      togglePlay();
    };
    window.addEventListener('influcine:toggle-playback', handleRemoteToggle as EventListener);
    return () => window.removeEventListener('influcine:toggle-playback', handleRemoteToggle as EventListener);
  }, [togglePlay]);

  useEffect(() => {
    if (isEmbed) return;
    const video = videoRef.current;
    if (!video) return;

    const logMediaError = (eventName: string) => {
      const mediaError = video.error;
      errorAgent.log({
        message: `Media ${eventName}`,
        type: eventName === 'error' ? 'ERROR' : 'WARN',
        context: {
          code: mediaError?.code,
          message: mediaError?.message,
          networkState: video.networkState,
          readyState: video.readyState,
          src,
          title,
          provider,
        },
      });
    };

    const onError = () => logMediaError('error');
    const onStalled = () => logMediaError('stalled');
    const onAbort = () => logMediaError('abort');

    video.addEventListener('error', onError);
    video.addEventListener('stalled', onStalled);
    video.addEventListener('abort', onAbort);

    return () => {
      video.removeEventListener('error', onError);
      video.removeEventListener('stalled', onStalled);
      video.removeEventListener('abort', onAbort);
    };
  }, [isEmbed, src, title, provider]);

  useEffect(() => {
    return () => {
      clearPendingPlayPauseRetry();
    };
  }, [clearPendingPlayPauseRetry]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Sync fullscreen state when browser handles exit (e.g. Escape key)
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    setAudioGain(newVolume);
    if (isEmbed) {
      iframeRef.current?.contentWindow?.postMessage({ command: 'setVolume', volume: newVolume }, '*');
      setIsMuted(newVolume === 0);
      return;
    }
    // Only set video element volume if we are NOT using the audio graph's GainNode heavily 
    // to avoid double attenuation (quadratic volume curve).
    // However, keeping video.volume=1 ensures the SourceNode gets full signal 
    // and we control it via GainNode.
    if (videoRef.current) {
        // Standard practice: Keep element volume at 1 and use GainNode for control
        // OR sync them. If we sync them, we get x^2 curve.
        // Let's rely on GainNode for smooth ramping and keep video volume fixed at 1
        // UNLESS the user wants to mute.
        // Actually, let's keep it simple: sync both but be aware of the curve.
        // Better UX: linear slider -> GainNode. video.volume = 1.
        videoRef.current.volume = 1; 
        videoRef.current.muted = newVolume === 0;
    }
    setIsMuted(newVolume === 0);
  }, [isEmbed, setAudioGain]);

  const toggleMute = useCallback(() => {
    if (isEmbed) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      setVolume(newMuted ? 0 : 1);
      setAudioGain(newMuted ? 0 : 1);
      iframeRef.current?.contentWindow?.postMessage({ command: 'setMute', muted: newMuted }, '*');
      return;
    }
    if (videoRef.current) {
      const newMuted = !isMuted; // Toggle local state
      
      // Update video element
      videoRef.current.muted = newMuted;
      
      // Update UI state
      setIsMuted(newMuted);

      if (newMuted) {
        setVolume(0); // Set UI slider to 0
        setAudioGain(0); // Mute GainNode
      } else {
        // Unmute: Restore to previous volume (or 1 if unknown)
        // For simplicity, restore to 1. Ideally we should store 'lastVolume'
        setVolume(1);
        setAudioGain(1);
        videoRef.current.volume = 1;
      }
    }
  }, [isEmbed, isMuted, setAudioGain]);

  const changeSpeed = useCallback((speed: number) => {
    if (isEmbed) {
      setPlaybackSpeed(speed);
      if (iframeRef.current?.contentWindow) {
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

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement> | number) => {
    const time = typeof e === 'number' ? e : parseFloat(e.target.value);
    if (isEmbed) {
      iframeRef.current?.contentWindow?.postMessage({ command: 'seek', time }, '*');
      setCurrentTime(time);
      return;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, [isEmbed]);

  const togglePip = useCallback(async () => {
    if (onPipToggle) {
        onPipToggle();
        return;
    }

    if (isEmbed) return;

    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (videoRef.current) {
            await videoRef.current.requestPictureInPicture();
        }
    } catch (e) {
        errorAgent.log({ message: 'PiP toggle failed', type: 'WARN', context: { error: String(e) } });
    }
  }, [isEmbed, onPipToggle]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Ignore if typing in an input
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

        if (isTVActionKey(e, 'playPause')) {
          e.preventDefault();
          togglePlay();
          return;
        }

        if (isTVActionKey(e, 'back')) {
          if (showSettings) {
            e.preventDefault();
            setShowSettings(false);
            return;
          }
          if (onBack) {
            e.preventDefault();
            onBack();
            return;
          }
        }

        switch(e.key.toLowerCase()) {
            case 'escape':
                e.preventDefault();
                if (showSettings) setShowSettings(false);
                break;
            case ' ':
            case 'k':
                e.preventDefault();
                togglePlay();
                break;
            case 'f':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'm':
                e.preventDefault();
                toggleMute();
                break;
            case 'arrowleft':
            case 'j':
                e.preventDefault();
                handleSeek(currentTime - 10);
                break;
            case 'arrowright':
            case 'l':
                e.preventDefault();
                handleSeek(currentTime + 10);
                break;
            case 'arrowup':
                e.preventDefault();
                handleVolumeChange(Math.min(1, volume + 0.1));
                break;
            case 'arrowdown':
                e.preventDefault();
                handleVolumeChange(Math.max(0, volume - 0.1));
                break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, currentTime, volume, handleSeek, handleVolumeChange, showSettings, onBack]);

  const handleLoadedMetadata = () => {
    if (isEmbed) return;
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      detectAudioCapabilities();
    }
  };

  const switchSubtitleTrack = useCallback(async (index: number) => {
    if (isEmbed) return;
    const video = videoRef.current;
    if (!video?.textTracks) return;

    const nativeTrackCount = video.textTracks.length;

    for (let i = 0; i < nativeTrackCount; i++) {
      video.textTracks[i].mode = 'hidden';
    }

    if (index === -1) {
      setActiveSubtitleIndex(-1);
      setCustomSubtitles([]);
      return;
    }

    // Native text tracks attached to the video element
    if (index < nativeTrackCount) {
      video.textTracks[index].mode = 'showing';
      setCustomSubtitles([]);
      setActiveEmbedTrackIndex(-1);
      setActiveAutoSubtitleIndex(-1);
      setActiveSubtitleIndex(index);
      return;
    }

    // External tracks are represented as virtual indexes after native tracks
    const externalIndex = index - nativeTrackCount;
    const externalTrack = externalSubtitles[externalIndex];
    if (!externalTrack?.url) return;

    try {
      const response = await fetch(externalTrack.url);
      if (!response.ok) throw new Error(`Failed to load subtitle: ${response.status}`);
      const content = await response.text();
      const cues = parseSubtitle(content);
      setCustomSubtitles(cues);
      setActiveEmbedTrackIndex(-1);
      setActiveAutoSubtitleIndex(-1);
      setActiveSubtitleIndex(index);
    } catch (e) {
      errorAgent.log({
        message: 'Failed to load external subtitle track',
        type: 'WARN',
        context: { error: String(e), subtitleUrl: externalTrack.url },
      });
    }
  }, [isEmbed, externalSubtitles, setActiveSubtitleIndex, setCustomSubtitles, setActiveEmbedTrackIndex, setActiveAutoSubtitleIndex]);

  // Block all popup ads while embed player is active
  useEffect(() => {
    if (!isEmbed) return;
    const origOpen = window.open;
    window.open = function() { return null; };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEmbed) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.open = origOpen;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isEmbed]);

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
    const handleTracks = (tracks: {index: number, label: string, language: string}[]) => {
        setEmbedTracks(tracks);
    };

    const handleAudioTracks = (
      tracks: { index: number; label: string; language: string; kind?: string; enabled?: boolean }[]
    ) => {
      setEmbedAudioTracks(
        (tracks || []).map((track) => ({
          id: `embed-${track.index}`,
          label: track.label || `Audio ${track.index + 1}`,
          language: track.language || 'unknown',
          kind: track.kind || 'main',
          enabled: !!track.enabled,
        }))
      );
    };

    const handleCues = (data: {index: number, cues: SubtitleCue[]}) => {
        if (data.index === activeEmbedTrackIndex) {
            setCustomSubtitles(data.cues);
        }
    };

    const handleStateUpdate = (state: { event?: string; currentTime?: number; duration?: number; paused?: boolean }) => {
        const { event: playerEvent, currentTime: ct, duration: dur, paused } = state;
        
        if (typeof ct === 'number') {
            setCurrentTime(ct);
            if (typeof dur === 'number') onTimeUpdate?.(ct, dur);
        }
        if (typeof dur === 'number') setDuration(dur);

        const isPaused = paused === true || playerEvent === 'pause';
        const isPlayingState = paused === false || playerEvent === 'play';

        if (isPlayingState) {
             setIsPlaying(true);
             onPlay?.();
             if (startTime > 0 && !hasResumed) {
                 iframeRef.current?.contentWindow?.postMessage({ command: 'seek', time: startTime }, '*');
                 setHasResumed(true);
             }
        } else if (isPaused) {
             setIsPlaying(false);
             onPause?.();
        }
    };

    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
    const unlisten: Array<() => void> = [];

    if (isTauri) {
        import('@tauri-apps/api/event').then(({ listen }) => {
            Promise.all([
                listen<{index: number, label: string, language: string}[]>('embed-tracks-found', (e) => handleTracks(e.payload)),
                listen<{ index: number; label: string; language: string; kind?: string; enabled?: boolean }[]>('embed-audio-tracks-found', (e) => handleAudioTracks(e.payload)),
                listen<{index: number, cues: SubtitleCue[]}>('embed-track-cues', (e) => handleCues(e.payload)),
                listen<{ event?: string; currentTime?: number; duration?: number; paused?: boolean }>('player-state-update', (e) => handleStateUpdate(e.payload)),
            ]).then(fns => unlisten.push(...fns));
        });
    }
    return () => {
        unlisten.forEach(fn => fn());
    };
  }, [activeEmbedTrackIndex, setEmbedTracks, setCustomSubtitles, startTime, hasResumed, onTimeUpdate, onPlay, onPause]);

  const loadEmbedTrack = (index: number) => {
      if (index === -1) {
          setActiveEmbedTrackIndex(-1);
          setCustomSubtitles([]);
          return;
      }
      setActiveSubtitleIndex(-1);
      setActiveAutoSubtitleIndex(-1);
      setActiveEmbedTrackIndex(index);
      setCustomSubtitles([]);
      try {
         iframeRef.current?.contentWindow?.postMessage({ command: 'get-embed-track-cues', index }, '*');
      } catch (e) {
         errorAgent.log({ message: 'Failed to send to webview', type: 'WARN', context: { error: String(e) } });
      }
  };

  const handleSubtitleUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt,.vtt';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                if (content) {
                    const cues = parseSubtitle(content);
                    setCustomSubtitles(cues);
                    // Reset other subtitle states to prioritize this custom upload
                    setActiveEmbedTrackIndex(-1);
                    setActiveAutoSubtitleIndex(-1);
                    setActiveSubtitleIndex(-1);
                }
            };
            reader.readAsText(file);
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
    <PlayerErrorBoundary>
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black group overflow-hidden font-sans select-none"
      onDoubleClick={toggleFullscreen}
    >
      <style>{getSubtitleStyles()}</style>

      {/* Persistent Window Controls - Always Top Z-Index */}
      <div className="absolute top-0 left-0 right-0 z-100 pointer-events-none">
        <TitleBar isOverlay className={isNativeMode ? 'opacity-0 hover:opacity-100 transition-opacity' : ''} />
      </div>

      {isEmbed ? (
        <div className="absolute inset-0 z-0">
          <iframe
            ref={iframeRef}
            src={embedSrc}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            src={src}
            style={{ filter: `brightness(${videoFilters.brightness}) contrast(${videoFilters.contrast}) saturate(${videoFilters.saturation})` }}
            className={`w-full h-full object-contain bg-black transition-opacity duration-300 ${isBuffering ? 'opacity-50' : 'opacity-100'}`}
            onTimeUpdate={() => {
              if (videoRef.current) {
                const t = videoRef.current.currentTime;
                setCurrentTime(t);
                onTimeUpdate?.(t, videoRef.current.duration);
              }
            }}
            onLoadedMetadata={handleLoadedMetadata}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => {
              setIsBuffering(false);
              setIsPlaying(true);
              onPlay?.();
            }}
            onPause={() => {
              setIsPlaying(false);
              onPause?.();
            }}
            onEnded={() => {
                setIsPlaying(false);
                onEnded?.();
            }}
            crossOrigin="anonymous"
            poster={poster}
            playsInline
          />
        </div>
      )}

      {/* Subtitle Overlay - Z-Index 10 */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <SubtitleOverlay 
          subtitles={customSubtitles} 
          currentTime={currentTime} 
          offset={0}
        />
      </div>

      {/* Header - Z-Index 20 */}
      {!isNativeMode && (
          <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
            <PlayerHeader 
              title={title} 
              onBack={onBack} 
              showControls={showControls}
              audioFormat={mediaData?.audio_format} 
            />
          </div>
      )}
      
      {/* Native Mode Action Cluster - Z-Index 50 */}
      {isNativeMode && (
          <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
              <button
                onClick={onBack}
                className="p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors backdrop-blur-md pointer-events-auto"
                title="Back"
                aria-label="Back"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors backdrop-blur-md pointer-events-auto"
                title="Settings"
                aria-label="Settings"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
          </div>
      )}

      {/* Center Overlay - Z-Index 30 */}
      {!isNativeMode && (
          <div className="absolute inset-0 z-30 pointer-events-none">
            <PlayerOverlay 
                isPlaying={isPlaying} 
                isBuffering={isBuffering} 
                onTogglePlay={togglePlay} 
            />
          </div>
      )}

      {/* Controls - Z-Index 40 */}
      {!isNativeMode && (
          <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-auto">
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
                isPip={isPip || internalPip}
                onPipToggle={togglePip}
                onNext={onNext}
                formatTime={formatTime}
                onLike={mediaData?.tmdbId ? () => handleVote('like') : undefined}
                onDislike={mediaData?.tmdbId ? () => handleVote('dislike') : undefined}
                userVote={userVote}
                analyserNode={analyserNode}
                sleepTimerRemaining={sleepTimerRemaining}
            />
          </div>
      )}

      {/* Up Next Card */}
      {upNext && onUpNextNow && (
        <div className="absolute right-4 bottom-24 z-[45] pointer-events-auto">
          <div className="rounded-xl border border-white/20 bg-black/75 backdrop-blur-lg p-3 shadow-2xl w-[260px]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 mb-1">Up Next</div>
            <div className="text-sm font-semibold text-white mb-2">
              Season {upNext.season} • Episode {upNext.episode}
            </div>
            <div className="text-xs text-white/70 mb-3">
              Playing automatically in {Math.max(0, upNext.countdown)}s
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onUpNextNow}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-white px-3 py-2 text-sm font-semibold hover:brightness-110 transition"
              >
                <SkipForward size={15} />
                Play Next
              </button>
              <button
                onClick={onUpNextDismiss}
                className="inline-flex items-center justify-center rounded-lg border border-white/20 text-white/80 hover:text-white hover:bg-white/10 px-2.5 py-2 transition"
                aria-label="Dismiss next episode"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel - Z-Index 50 */}
      {showSettings && (
          <div className="absolute top-0 right-0 bottom-0 z-50 pointer-events-auto">
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
                availableTracks={effectiveAudioTracks}
                onTrackChange={(track) => {
                  if (isEmbed) {
                    const raw = track.id?.startsWith('embed-')
                      ? track.id.replace('embed-', '')
                      : String(effectiveAudioTracks.findIndex((t) => t === track));
                    const trackIndex = Number(raw);
                    if (Number.isFinite(trackIndex) && trackIndex >= 0) {
                      iframeRef.current?.contentWindow?.postMessage({ command: 'setAudioTrack', trackIndex }, '*');
                    }
                    return;
                  }
                  switchAudioTrack(track);
                }}
                availableSubtitles={availableSubtitles}
                externalSubtitles={externalSubtitles}
                activeSubtitleIndex={activeSubtitleIndex}
                onSubtitleChange={switchSubtitleTrack}
                embedTracks={embedTracks}
                activeEmbedTrackIndex={activeEmbedTrackIndex}
                onEmbedTrackChange={loadEmbedTrack}
                autoSubtitles={autoSubtitles.map(s => ({ ...s, format: s.format || 'vtt' }))}
                activeAutoSubtitleIndex={activeAutoSubtitleIndex}
                onAutoSubtitleChange={(index) => {
                    if (index !== -1) {
                        setActiveSubtitleIndex(-1);
                        setActiveEmbedTrackIndex(-1);
                    }
                    loadAutoSubtitle(index);
                }}
                isSearchingSubs={isSearchingSubs}
                onUploadClick={handleSubtitleUpload}
                onSearchOnline={() => {
                    const query = title ? encodeURIComponent(title) : '';
                    window.open(`https://www.opensubtitles.org/en/search/sublanguageid-all/moviename-${query}`, '_blank');
                }}
                provider={provider}
                onProviderChange={onProviderChange}
                isNativeMode={isNativeMode}
                onToggleNativeMode={toggleNativeMode}
                videoFilters={videoFilters}
                onVideoFiltersChange={setVideoFilters}
                sleepTimerMinutes={sleepTimerMinutes}
                onStartSleepTimer={startSleepTimer}
                onCancelSleepTimer={cancelSleepTimer}
                sleepTimerRemaining={sleepTimerRemaining}
                hasSubtitleOptions={hasSubtitleOptions}
                hasDubOptions={hasDubOptions}
            />
          </div>
      )}
    </div>
    </PlayerErrorBoundary>
  );
};

export default InflucinePlayer;
