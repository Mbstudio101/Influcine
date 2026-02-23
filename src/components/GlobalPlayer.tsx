import React, { useEffect, useState, useCallback, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import InflucinePlayer from './InflucinePlayer';
import { useEmbedUrl, StreamProvider } from '../hooks/useEmbedUrl';
import { X, Maximize2, Monitor } from 'lucide-react';
import { usePlayerProgress } from '../hooks/usePlayerProgress';
import { usePlayerAnalytics } from '../hooks/usePlayerAnalytics';
import { useLocation } from 'react-router-dom';
import { getExternalIds } from '../services/tmdb';

const GlobalPlayer: React.FC = () => {
  const { state, close, maximize, togglePip, play } = usePlayer();
  const { mode, media, season, episode, startTime: requestedStartTime } = state;
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  
  // Close player on route change (e.g. browser back button)
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      if (mode === 'full') {
        close();
      }
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname, mode, close]);

  const [startTime, setStartTime] = useState(requestedStartTime || 0);
  const isPlayingRef = useRef(false);
  const [provider, setProvider] = useState<StreamProvider>('vidlink');
  const [resolvedImdbId, setResolvedImdbId] = useState<string | undefined>(media?.imdb_id);

  // PiP Size Management
  const [pipSize, setPipSize] = useState<'sm' | 'md' | 'lg'>('md');

  const toggleSize = useCallback(() => {
    setPipSize(prev => {
      if (prev === 'sm') return 'md';
      if (prev === 'md') return 'lg';
      return 'sm';
    });
  }, []);

  const getPipStyle = useCallback(() => {
    switch (pipSize) {
      case 'sm':
        return { width: '320px', height: '180px' };
      case 'lg':
        return { width: '640px', height: '360px' };
      case 'md':
      default:
        return { width: '480px', height: '270px' };
    }
  }, [pipSize]);

  const [nextEpisode, setNextEpisode] = useState<{ season: number; episode: number } | null>(null);
  const [showUpNext, setShowUpNext] = useState(false);
  const [upNextCountdown, setUpNextCountdown] = useState<number | null>(null);
  const [upNextDismissed, setUpNextDismissed] = useState(false);
  const hasAutoAdvancedRef = useRef(false);

  const type = media?.media_type === 'tv' ? 'tv' : 'movie';
  const id = media?.id?.toString();

  useEffect(() => {
    let cancelled = false;
    const mediaImdb = media?.imdb_id;

    if (!media?.id) {
      setResolvedImdbId(undefined);
      return;
    }

    if (mediaImdb) {
      setResolvedImdbId(mediaImdb);
      return;
    }

    setResolvedImdbId(undefined);
    getExternalIds(type, media.id)
      .then((external) => {
        if (cancelled) return;
        setResolvedImdbId(external?.imdb_id || undefined);
      })
      .catch(() => {
        if (cancelled) return;
        setResolvedImdbId(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [media?.id, media?.imdb_id, type]);

  // Resolve stream
  const streamUrl = null;
  const isResolving = false;

  const embedUrl = useEmbedUrl({
    type: type,
    id: id || '',
    season,
    episode,
    startTime,
    provider
  });

  // Calculate next episode
  useEffect(() => {
    if (media?.media_type === 'tv' && media.seasons && season && episode) {
      const currentSeason = media.seasons.find(s => s.season_number === season);
      if (currentSeason) {
        if (currentSeason.episode_count && episode < currentSeason.episode_count) {
          setNextEpisode({ season, episode: episode + 1 });
        } else {
          const nextSeason = media.seasons.find(s => s.season_number === season + 1);
          if (nextSeason && nextSeason.episode_count > 0) {
            setNextEpisode({ season: season + 1, episode: 1 });
          } else {
            setNextEpisode(null);
          }
        }
      }
    } else {
      setNextEpisode(null);
    }
  }, [media, season, episode]);

  // Progress and Analytics
  const { 
    initialStartTime: savedStartTime, 
    saveProgress, 
    flushProgress 
  } = usePlayerProgress({
    type: type,
    id: id || '',
    details: media || undefined,
    season,
    episode
  });

  const {
    trackPlayStart,
    trackTimeUpdate,
    trackPause,
    trackEnded
  } = usePlayerAnalytics({
    type: type,
    details: media || undefined,
    season,
    episode
  });

  // Restore progress
  useEffect(() => {
    // If we have a requested start time (e.g. from "Resume" button), use it.
    // Otherwise use saved progress.
    if (requestedStartTime && requestedStartTime > 0) {
      setStartTime(requestedStartTime);
    } else if (savedStartTime > 0) {
      setStartTime(savedStartTime);
    }
  }, [requestedStartTime, savedStartTime]);

  const handleNext = useCallback(() => {
    if (nextEpisode && media) {
      hasAutoAdvancedRef.current = true;
      play(media, nextEpisode.season, nextEpisode.episode);
    }
  }, [nextEpisode, media, play]);

  const dismissUpNext = useCallback(() => {
    setShowUpNext(false);
    setUpNextCountdown(null);
    setUpNextDismissed(true);
  }, []);

  const handlePlay = useCallback(async () => {
    isPlayingRef.current = true;
    await trackPlayStart(startTime);
  }, [trackPlayStart, startTime]);

  const handlePause = useCallback(() => {
    isPlayingRef.current = false;
    trackPause();
    flushProgress();
  }, [trackPause, flushProgress]);

  const handleTimeUpdate = useCallback(async (currentTime: number, duration: number) => {
    await trackTimeUpdate(currentTime);
    await saveProgress(currentTime, duration);

    if (!nextEpisode || !duration || duration <= 0 || upNextDismissed) return;

    const remaining = duration - currentTime;
    if (remaining <= 30 && remaining > 0) {
      setShowUpNext(true);
      setUpNextCountdown(prev => prev ?? 10);
    } else if (remaining > 45) {
      setShowUpNext(false);
      setUpNextCountdown(null);
    }
  }, [trackTimeUpdate, saveProgress, nextEpisode, upNextDismissed]);

  const handleEnded = useCallback(async () => {
    await trackEnded();
    await flushProgress();
    if (nextEpisode && !hasAutoAdvancedRef.current) {
      handleNext();
    }
  }, [trackEnded, flushProgress, nextEpisode, handleNext]);

  useEffect(() => {
    hasAutoAdvancedRef.current = false;
    setShowUpNext(false);
    setUpNextCountdown(null);
    setUpNextDismissed(false);
  }, [media?.id, season, episode, nextEpisode?.season, nextEpisode?.episode]);

  useEffect(() => {
    if (!showUpNext || upNextCountdown === null || upNextDismissed || !nextEpisode) return;
    if (upNextCountdown <= 0) {
      if (!hasAutoAdvancedRef.current) {
        handleNext();
      }
      return;
    }

    const timer = setTimeout(() => {
      setUpNextCountdown(prev => (prev === null ? null : prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [showUpNext, upNextCountdown, upNextDismissed, nextEpisode, handleNext]);

  if (mode === 'hidden' || !media) return null;

  const isMini = mode === 'mini';

  // Construct title
  let title = media.title || media.name || '';
  if (media.media_type === 'tv' && season && episode) {
    title += ` - S${season}E${episode}`;
  }

  // Show loading only if we are resolving AND have no embed URL to fall back to immediately?
  // Actually, we prefer source, so show loading.
  if (isResolving) {
     // We can show a loading overlay inside the player component instead of returning null
     // But for now, let's just return a simple loader if full screen, or keep it hidden if mini?
  }

  return (
    <div 
        className={isMini 
            ? "fixed bottom-4 right-4 z-[200] shadow-2xl rounded-lg overflow-hidden border border-white/10 transition-all duration-300 bg-black group/mini"
            : "fixed inset-0 z-[200] bg-black"
        }
        style={isMini ? getPipStyle() : {}}
    >
        {/* Mini Player Header/Overlay */}
        {isMini && (
            <div className="absolute top-0 left-0 right-0 p-2 flex justify-between items-start z-40 opacity-0 group-hover/mini:opacity-100 transition-opacity bg-linear-to-b from-black/80 to-transparent pointer-events-none">
                <div className="flex gap-2 pointer-events-auto">
                     <button 
                        onClick={toggleSize}
                        className="p-1.5 rounded-full bg-black/60 text-white hover:bg-primary hover:text-white transition-colors"
                        title="Resize"
                     >
                        <Monitor size={16} />
                     </button>
                     <button 
                        onClick={maximize}
                        className="p-1.5 rounded-full bg-black/60 text-white hover:bg-primary hover:text-white transition-colors"
                        title="Maximize"
                     >
                        <Maximize2 size={16} />
                     </button>
                     <button 
                        onClick={close}
                        className="p-1.5 rounded-full bg-black/60 text-white hover:bg-red-500 hover:text-white transition-colors"
                        title="Close"
                     >
                        <X size={16} />
                     </button>
                </div>
            </div>
        )}

        {isResolving ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white">
                 <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                 <p className="text-xs font-medium opacity-70">Loading stream...</p>
            </div>
        ) : (
            <InflucinePlayer
                title={title}
                src={streamUrl || undefined}
                embedSrc={streamUrl ? undefined : embedUrl}
                poster={media.poster_path ? `https://image.tmdb.org/t/p/w1280${media.backdrop_path || media.poster_path}` : undefined}
                startTime={startTime}
                onBack={close}
                onPipToggle={() => {
                    if (isMini) {
                        maximize();
                    } else {
                        togglePip();
                    }
                }}
                isPip={isMini}
                mediaData={{
            tmdbId: id,
            imdbId: resolvedImdbId,
            type: type,
            season: season,
            episode: episode
          }}
                onNext={nextEpisode ? handleNext : undefined}
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                onTimeUpdate={handleTimeUpdate}
                provider={provider}
                onProviderChange={(p) => setProvider(p as StreamProvider)}
                upNext={showUpNext && nextEpisode ? { countdown: upNextCountdown ?? 0, season: nextEpisode.season, episode: nextEpisode.episode } : undefined}
                onUpNextNow={nextEpisode ? handleNext : undefined}
                onUpNextDismiss={dismissUpNext}
            />
        )}
    </div>
  );
};

export default GlobalPlayer;
