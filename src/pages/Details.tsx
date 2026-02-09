import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDetails, getCredits, getSimilar, getImageUrl, getSeasonDetails, findMediaByImdbId } from '../services/tmdb';
import { MediaDetails, Episode, CastMember } from '../types';
import { Play, Plus, Check, Star, ArrowLeft, Download, Youtube } from 'lucide-react';
import { db } from '../db';
import { useAuth } from '../context/useAuth';
import { usePlayer } from '../context/PlayerContext';
import ContentRow from '../components/ContentRow';
import Focusable from '../components/Focusable';
import { useWatchlist } from '../hooks/useWatchlist';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../context/toast';
import { downloadService } from '../services/downloadService';
import { useEmbedUrl } from '../hooks/useEmbedUrl';
import { findBestTrailer } from '../utils/videoUtils';
import { useTrailerCache } from '../hooks/useTrailerCache';
import TrailerModal from '../components/TrailerModal';
import { electronService } from '../services/electron';
import { CastImage } from '../components/CastImage';

const Details: React.FC = () => {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { play } = usePlayer();
  const [showTrailer, setShowTrailer] = useState(false);
  const [userSelectedSeason, setUserSelectedSeason] = useState<number | null>(null);
  const { profile } = useAuth();

  const { data: mediaData, isLoading, error: queryError } = useQuery({
    queryKey: ['media', type, id, location.state],
    queryFn: async () => {
      if (!type || !id) throw new Error('Missing parameters');

      let numericId = parseInt(id);

      // Handle local IMDB items (id=0)
      if (numericId === 0) {
        const stateImdbId = location.state?.imdb_id;
        if (stateImdbId) {
          const resolved = await findMediaByImdbId(stateImdbId);
          if (resolved) {
            numericId = resolved.id;
            // Update URL without reload to reflect real ID
            window.history.replaceState(null, '', `/details/${type}/${numericId}`);
          } else {
            // Fallback: Display minimal details from state if resolution fails
            return {
              details: {
                id: 0,
                title: location.state?.title || 'Unknown Title',
                name: location.state?.title || 'Unknown Title',
                overview: location.state?.overview || 'No overview available.',
                poster_path: null,
                backdrop_path: null,
                vote_average: location.state?.vote_average || 0,
                media_type: type,
                genres: [],
                videos: { results: [] }
              } as MediaDetails,
              credits: null
            };
          }
        }
      }

      const [detailData, creditsData] = await Promise.all([
        getDetails(type, numericId),
        getCredits(type, numericId)
      ]);
      return { details: detailData, credits: creditsData };
    },
    enabled: !!type && !!id,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const details = mediaData?.details || null;
  const credits = mediaData?.credits || null;
  const error = queryError ? 'Failed to load details' : null;

  const { isSaved, toggleWatchlist } = useWatchlist(details ? {
    ...details,
    media_type: (type as 'movie' | 'tv') || details.media_type
  } : null);
  const effectiveType: 'movie' | 'tv' | undefined = (details?.media_type as 'movie' | 'tv') || type;

  // History for progress tracking
  const historyItem = useLiveQuery(
    () => (effectiveType === 'tv' && id) ? db.history.get(parseInt(id)) : undefined,
    [effectiveType, id]
  );

  const activeSeason = useMemo(() => {
    if (userSelectedSeason !== null) return userSelectedSeason;
    if (historyItem?.progress?.season) return historyItem.progress.season;
    if (details?.seasons && details.seasons.length > 0) {
      const s = details.seasons.find(sea => (sea.season_number ?? 1) >= 1);
      return (s?.season_number ?? 1);
    }
    return 1;
  }, [userSelectedSeason, historyItem, details]);

  const activeEpisode = useMemo(() => {
    if (historyItem?.progress?.episode) return historyItem.progress.episode;
    return 1;
  }, [historyItem]);

  // Prefetch Video URL (Headless Warmup)
  const prefetchUrl = useEmbedUrl({
    type: effectiveType || 'movie',
    id: id || '',
    season: activeSeason,
    episode: activeEpisode,
    autoPlay: false
  });

  React.useEffect(() => {
    if (prefetchUrl) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = prefetchUrl;
      link.as = 'document';
      document.head.appendChild(link);

      try {
        const url = new URL(prefetchUrl);
        const preconnect = document.createElement('link');
        preconnect.rel = 'preconnect';
        preconnect.href = url.origin;
        preconnect.crossOrigin = 'anonymous';
        document.head.appendChild(preconnect);

        return () => {
          if (document.head.contains(link)) document.head.removeChild(link);
          if (document.head.contains(preconnect)) document.head.removeChild(preconnect);
        };
      } catch (e) {
        return () => {
          if (document.head.contains(link)) document.head.removeChild(link);
        };
      }
    }
  }, [prefetchUrl]);

  // Fetch Episodes for Selected Season
  const { data: seasonData, isLoading: loadingEpisodes } = useQuery({
    queryKey: ['season', id, activeSeason],
    queryFn: () => getSeasonDetails(parseInt(id!), activeSeason),
    enabled: effectiveType === 'tv' && !!id && !!activeSeason,
    staleTime: 1000 * 60 * 30,
  });

  const episodes = seasonData?.episodes || [];

  // Live Query for Episode Progress
  const episodeProgressList = useLiveQuery(
    () => (profile?.id && effectiveType === 'tv' && id) ?
      db.episodeProgress
        .where(['profileId', 'showId'])
        .equals([profile.id, parseInt(id)])
        .filter(r => r.season === activeSeason)
        .toArray() : [],
    [profile?.id, id, activeSeason, effectiveType]
  );

  const defaultList = useMemo(() => [], []);
  const safeEpisodeProgressList = episodeProgressList || defaultList;

  const episodeProgress = useMemo(() => {
    const map: Record<number, number> = {};
    safeEpisodeProgressList.forEach(r => { map[r.episode] = r.percentage; });
    return map;
  }, [safeEpisodeProgressList]);


  const [activeTrailerKey, setActiveTrailerKey] = useState<string | null>(null);
  const failedTrailerKeys = useRef<Set<string>>(new Set());

  React.useEffect(() => {
    let mounted = true;
    // Reset failed keys when media changes
    failedTrailerKeys.current.clear();

    const fetchTrailer = async () => {
      // 1. Try TMDB results first
      if (details?.videos?.results) {
        const best = findBestTrailer(details.videos.results);
        if (best) {
          if (mounted) setActiveTrailerKey(best.key);
          return;
        }
      }

      // 2. Fallback: Search YouTube if no official trailer found
      if (details) {
         const title = details.title || details.name;
         if (title) {
           try {
             // Search for "Title Trailer"
             const key = await electronService.searchTrailer(title);
             if (mounted && key) {
               setActiveTrailerKey(key);
             } else if (mounted) {
               setActiveTrailerKey(null);
             }
           } catch {
             if (mounted) setActiveTrailerKey(null);
           }
         }
      }
    };

    fetchTrailer();

    return () => { mounted = false; };
  }, [details]);

  const cachedTrailerUrl = useTrailerCache(activeTrailerKey || undefined);
  const [isTrailerReady, setIsTrailerReady] = useState(false);
  const [trailerTimedOut, setTrailerTimedOut] = useState(false);

  // Reset trailer ready state when URL changes + add loading timeout
  React.useEffect(() => {
    setIsTrailerReady(false);
    setTrailerTimedOut(false);

    if (!cachedTrailerUrl) return;

    const timeout = setTimeout(() => {
      setTrailerTimedOut(true);
    }, 15000); // 15s timeout — if trailer can't load by then, show static image

    return () => clearTimeout(timeout);
  }, [cachedTrailerUrl]);

  const handleWatch = async () => {
    if (!details) return;
    try {
      // Explicitly construct to avoid Dexie errors
      await db.history.put({
        id: Number(details.id),
        title: details.title,
        name: details.name,
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        overview: details.overview,
        vote_average: details.vote_average,
        media_type: details.media_type,
        savedAt: Date.now()
      });
    } catch (error) {
      console.error('Failed to save history:', error);
    }

    if (effectiveType === 'tv') {
      const s = historyItem?.progress?.season || 1;
      const e = historyItem?.progress?.episode || 1;
      play(details, s, e);
    } else {
      play(details);
    }
  };

  const handleDownload = async () => {
    if (!details) return;
    try {
      await downloadService.startDownload(details);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Download failed';
      showToast(message, 'error');
    }
  };

  const handlePlayEpisode = async (season: number, episode: number) => {
    if (!details) return;
    try {
      await db.history.put({
        ...details,
        savedAt: Date.now(),
        progress: {
          watched: 0,
          duration: 0,
          percentage: 0,
          lastUpdated: Date.now(),
          season,
          episode
        }
      });
    } catch (error) {
      console.error('Failed to set episode for playback:', error);
    }
    if (effectiveType && details) {
      play(details, season, episode);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white gap-6">
        <p className="text-xl text-red-400 font-medium">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors font-semibold"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (isLoading || !details) return <div className="flex items-center justify-center h-full text-white">Loading...</div>;

  return (
    <div className="h-full overflow-y-auto pb-20 relative scrollbar-hide">
      {/* Back Button */}
      <Focusable
        as="button"
        onClick={() => navigate(-1)}
        className="absolute top-16 left-6 z-50 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-primary transition-colors"
        activeClassName="ring-2 ring-primary bg-primary"
        autoFocus
      >
        <ArrowLeft size={24} />
      </Focusable>

      {/* Trailer Modal */}
      {showTrailer && activeTrailerKey && (
        <TrailerModal
          videoKey={activeTrailerKey}
          title={details.title || details.name}
          onClose={() => setShowTrailer(false)}
        />
      )}

      {/* Hero Section */}
      <div className="relative w-full h-[70vh]">
        <div className="absolute inset-0">
          {activeTrailerKey && cachedTrailerUrl && !trailerTimedOut ? (
            <div className="w-full h-full relative pointer-events-none">
              <video
                key={activeTrailerKey}
                className={`w-full h-full object-cover object-top transition-opacity duration-1000 ${isTrailerReady ? 'opacity-100' : 'opacity-0'}`}
                src={cachedTrailerUrl}
                autoPlay
                muted
                loop
                playsInline
                onCanPlay={() => setIsTrailerReady(true)}
                onError={() => {
                  setIsTrailerReady(false);

                  // Track this key as failed to prevent infinite retry loops
                  if (activeTrailerKey) {
                    failedTrailerKeys.current.add(activeTrailerKey);
                    window.ipcRenderer?.invoke('trailer-invalidate', activeTrailerKey).catch(() => {});
                  }

                  // Find next trailer that hasn't already failed
                  if (details?.videos?.results) {
                    const remaining = details.videos.results.filter(
                      v => v.site === 'YouTube' && !failedTrailerKeys.current.has(v.key)
                    );
                    const nextBest = findBestTrailer(remaining);
                    if (nextBest) {
                      setActiveTrailerKey(nextBest.key);
                    } else {
                      // All trailers failed — give up and show static image
                      setActiveTrailerKey(null);
                    }
                  } else {
                    setActiveTrailerKey(null);
                  }
                }}
              />
              {!isTrailerReady && (
                <img
                  src={getImageUrl(details.backdrop_path, 'original')}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  alt=""
                  loading="eager"
                  decoding="async"
                />
              )}
              <div className="absolute inset-0 bg-black/20" />
            </div>
          ) : (
            <img
              src={getImageUrl(details.backdrop_path, 'original')}
              srcSet={`
                ${getImageUrl(details.backdrop_path, 'w780')} 780w,
                ${getImageUrl(details.backdrop_path, 'w1280')} 1280w,
                ${getImageUrl(details.backdrop_path, 'original')} 1920w
              `}
              sizes="100vw"
              alt={details.title || details.name}
              className="w-full h-full object-cover object-top"
              loading="eager"
              decoding="async"
            />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-r from-background via-background/80 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 p-10 w-full max-w-4xl pb-10 z-10 flex gap-8 items-end">
          {/* Poster */}
          <div className="hidden md:block w-72 rounded-lg overflow-hidden shadow-2xl border border-white/10 rotate-3 transform hover:rotate-0 transition-transform duration-500">
            <img
              src={getImageUrl(details.poster_path)}
              alt={details.title || details.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div className="flex-1">
            <h1 className="text-5xl font-black mb-2 drop-shadow-2xl leading-tight text-white tracking-tight line-clamp-2">
              {details.title || details.name}
            </h1>

            <div className="flex items-center gap-4 text-gray-300 mb-6 text-sm font-medium">
              <span className="flex items-center gap-1 text-yellow-400">
                <Star size={16} fill="currentColor" /> {details.vote_average.toFixed(1)}
              </span>
              <span>{new Date(details.release_date || details.first_air_date || '').getFullYear()}</span>
              {details.runtime && <span>{Math.floor(details.runtime / 60)}h {details.runtime % 60}m</span>}
              {details.number_of_seasons && <span>{details.number_of_seasons} Seasons</span>}
              <div className="flex gap-2">
                {details.genres?.slice(0, 3).map(g => (
                  <span key={g.id} className="px-2 py-0.5 border border-white/20 rounded-md text-xs">{g.name}</span>
                ))}
              </div>
            </div>

            <div className="max-h-[20vh] overflow-y-auto scrollbar-hide mb-8">
              <p className="text-lg text-gray-200 drop-shadow-md leading-relaxed font-medium">
                {details.overview}
              </p>
            </div>

            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              <button
                onClick={handleWatch}
                className="bg-linear-to-r from-primary to-purple-600 hover:from-primary-hover hover:to-purple-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-3 transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(124,58,237,0.5)] hover:shadow-[0_0_30px_rgba(124,58,237,0.7)] text-lg shrink-0 border border-white/10 uppercase tracking-wide group"
              >
                <Play fill="currentColor" size={20} className="group-hover:animate-pulse" />
                Watch Now
              </button>
              {activeTrailerKey && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="bg-white/5 hover:bg-white/10 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-3 transition-all duration-300 backdrop-blur-md border border-white/10 hover:border-white/30 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] text-lg shrink-0"
                >
                  <Youtube size={20} className="text-red-500" />
                  Trailer
                </button>
              )}
              <button
                onClick={toggleWatchlist}
                className={`px-8 py-3 rounded-xl font-bold flex items-center gap-3 transition-all duration-300 backdrop-blur-md border hover:scale-105 text-lg shrink-0 ${isSaved
                  ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]'
                  : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                  }`}
              >
                {isSaved ? <Check size={20} /> : <Plus size={20} />}
                {isSaved ? 'In Library' : 'Add to Library'}
              </button>

              <button
                onClick={handleDownload}
                className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-3 transition-all duration-300 backdrop-blur-md border border-white/10 hover:border-white/30 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] text-lg shrink-0"
              >
                <Download size={20} />
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

      {effectiveType === 'tv' && details && (
        <div className="px-10 py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Episodes</h2>
            {details.number_of_seasons && details.number_of_seasons > 1 && (
              <div className="flex items-center gap-2">
                {Array.from({ length: details.number_of_seasons }, (_, i) => i + 1).map(s => (
                  <Focusable
                    key={s}
                    as="button"
                    onClick={() => setUserSelectedSeason(s)}
                    className={`px-3 py-1 rounded-full text-sm border ${activeSeason === s ? 'bg-primary text-white border-primary' : 'bg-white/5 text-gray-300 border-white/10'
                      }`}
                    activeClassName="ring-2 ring-primary"
                  >
                    S{s}
                  </Focusable>
                ))}
              </div>
            )}
          </div>

          {loadingEpisodes ? (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="min-w-[260px] rounded-xl border border-white/10 overflow-hidden">
                  <div className="w-full aspect-video bg-white/5 animate-pulse" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                    <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
                    <div className="h-2 w-full bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`season-${activeSeason}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
              >
                {(() => {
                  const progressed = Object.entries(episodeProgress).sort((a, b) => b[1] - a[1])[0];
                  const autoFocusEp = progressed ? Number(progressed[0]) : 1;
                  return episodes.map((ep: Episode) => {
                    const pct = episodeProgress[ep.episode_number] || 0;
                    const showBar = pct >= 2;
                    const completed = pct >= 90;
                    return (
                      <Focusable
                        key={ep.id}
                        as={motion.button}
                        onClick={() => handlePlayEpisode(activeSeason, ep.episode_number)}
                        className="min-w-[260px] bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 overflow-hidden text-left"
                        activeClassName="ring-2 ring-primary scale-[1.02]"
                        autoFocus={ep.episode_number === autoFocusEp}
                        whileHover={{ scale: 1.02 }}
                        whileFocus={{ scale: 1.02 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      >
                        <div className="w-full aspect-video bg-black/40">
                          <img
                            src={getImageUrl(ep.still_path, 'w500')}
                            alt={ep.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-primary">EP {ep.episode_number}</span>
                            {ep.runtime && <span className="text-[10px] text-gray-400">{ep.runtime}m</span>}
                          </div>
                          <div className="text-sm font-bold text-white truncate">{ep.name}</div>
                          {showBar && (
                            <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                              <div className={`h-full ${completed ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                            </div>
                          )}
                        </div>
                      </Focusable>
                    );
                  });
                })()}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Cast Section */}
      {credits && credits.cast && credits.cast.length > 0 && (
        <div className="px-10 py-8">
          <h2 className="text-xl font-bold mb-4 text-white">Top Cast</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {credits.cast.slice(0, 10).map((actor: CastMember) => (
              <div key={actor.id} className="min-w-[100px] flex flex-col items-center gap-2 text-center">
                <div className="w-20 h-20 rounded-full overflow-hidden border border-white/10">
                  <CastImage
                    name={actor.name}
                    profilePath={actor.profile_path}
                    alt={actor.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-full">
                  <p className="text-sm font-bold text-white leading-tight truncate px-1">{actor.name}</p>
                  <p className="text-xs text-gray-400 leading-tight truncate px-1">{actor.character}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similar Content */}
      <div className="mt-4">
        <ContentRow
          title="More Like This"
          fetcher={() => getSimilar(type as 'movie' | 'tv', parseInt(id as string))}
        />
      </div>
    </div>
  );
};

export default Details;
