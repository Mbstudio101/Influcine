import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDetails, getCredits, getSimilar, getImageUrl, getSeasonDetails } from '../services/tmdb';
import { MediaDetails, Episode } from '../types';
import { Play, Plus, Check, Star, ArrowLeft, X, Youtube, ExternalLink } from 'lucide-react';
import { db } from '../db';
import { useAuth } from '../context/useAuth';
import ContentRow from '../components/ContentRow';
import Focusable from '../components/Focusable';
import { useWatchlist } from '../hooks/useWatchlist';
import { motion, AnimatePresence } from 'framer-motion';

const Details: React.FC = () => {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<MediaDetails | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [credits, setCredits] = useState<any>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const { profile } = useAuth();
  const [episodeProgress, setEpisodeProgress] = useState<Record<number, number>>({});
  
  const { isSaved, toggleWatchlist } = useWatchlist(details ? {
    ...details,
    media_type: (type as 'movie' | 'tv') || details.media_type
  } : null);
  const effectiveType: 'movie' | 'tv' | undefined = (details?.media_type as 'movie' | 'tv') || type;

  useEffect(() => {
    if (type && id) {
      const fetchData = async () => {
        try {
          const detailData = await getDetails(type, parseInt(id));
          const creditsData = await getCredits(type, parseInt(id));
          setDetails(detailData);
          setCredits(creditsData);
        } catch (error) {
          console.error('Failed to fetch details:', error);
        }
      };
      fetchData();
      window.scrollTo(0, 0);
    }
  }, [type, id]);

  useEffect(() => {
    const initSeason = async () => {
      if (effectiveType === 'tv' && id) {
        try {
          const hist = await db.history.get(parseInt(id));
          if (hist?.progress?.season) {
            setSelectedSeason(hist.progress.season);
          } else if (details?.seasons && details.seasons.length > 0) {
            const s = details.seasons.find(sea => (sea.season_number ?? 1) >= 1);
            setSelectedSeason((s?.season_number ?? 1) || 1);
          }
        } catch {
          setSelectedSeason(1);
        }
      }
    };
    initSeason();
  }, [effectiveType, id, details]);

  useEffect(() => {
    const loadEpisodes = async () => {
      if (effectiveType !== 'tv' || !id) return;
      setLoadingEpisodes(true);
      try {
        const data = await getSeasonDetails(parseInt(id), selectedSeason);
        setEpisodes(data.episodes || []);
        if (profile?.id) {
          const rows = await db.episodeProgress
            .where(['profileId', 'showId'])
            .equals([profile.id, parseInt(id)])
            .filter(r => r.season === selectedSeason)
            .toArray();
          const map: Record<number, number> = {};
          rows.forEach(r => { map[r.episode] = r.percentage; });
          setEpisodeProgress(map);
        } else {
          setEpisodeProgress({});
        }
      } catch (error) {
        console.error('Failed to load episodes:', error);
        setEpisodes([]);
        setEpisodeProgress({});
      } finally {
        setLoadingEpisodes(false);
      }
    };
    loadEpisodes();
  }, [effectiveType, id, selectedSeason, profile]);

  const trailer = details?.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || details?.videos?.results?.find(v => v.site === 'YouTube');

  const handleWatch = async () => {
    if (!details) return;
    try {
      await db.history.put({ ...details, savedAt: Date.now() });
    } catch (error) {
      console.error('Failed to save history:', error);
    }
    if (effectiveType) navigate(`/watch/${effectiveType}/${details.id}`);
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
    if (effectiveType) navigate(`/watch/${effectiveType}/${details.id}`);
  };

  if (!details) return <div className="flex items-center justify-center h-full text-white">Loading...</div>;

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
      {showTrailer && trailer && (
        <div className="fixed inset-0 z-100 bg-black/90 flex items-center justify-center p-4">
          <Focusable
            as="button"
            onClick={() => setShowTrailer(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white"
            activeClassName="ring-2 ring-primary bg-white/20"
            autoFocus
          >
            <X size={24} />
          </Focusable>
          <div className="w-full max-w-5xl flex flex-col gap-4">
            <div className="aspect-video rounded-xl overflow-hidden shadow-2xl bg-black">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            
            <div className="flex justify-center">
              <a 
                href={`https://www.youtube.com/watch?v=${trailer.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-6 py-3 rounded-lg font-bold transition-all"
              >
                <ExternalLink size={20} />
                Having trouble? Watch on YouTube
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative w-full h-[70vh]">
        <div className="absolute inset-0">
          <img
            src={getImageUrl(details.backdrop_path, 'original')}
            alt={details.title || details.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-r from-background via-background/80 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 p-10 w-full max-w-4xl pb-10 z-10 flex gap-8 items-end">
          {/* Poster */}
          <div className="hidden md:block w-48 rounded-lg overflow-hidden shadow-2xl border border-white/10 rotate-3 transform hover:rotate-0 transition-transform duration-500">
            <img 
              src={getImageUrl(details.poster_path)} 
              alt={details.title || details.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1">
            <h1 className="text-5xl font-black mb-2 drop-shadow-2xl leading-tight text-white tracking-tight">
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

            <p className="text-lg text-gray-200 mb-8 line-clamp-3 drop-shadow-md leading-relaxed font-medium">
              {details.overview}
            </p>

            <div className="flex gap-4">
              <button
                onClick={handleWatch}
                className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-lg font-bold flex items-center gap-3 transition-all hover:scale-105 shadow-[0_0_30px_rgba(124,58,237,0.4)] text-lg"
              >
                <Play fill="currentColor" size={20} />
                Watch Now
              </button>
              {trailer && (
                <button 
                  onClick={() => setShowTrailer(true)}
                  className="bg-white/10 hover:bg-red-600 hover:border-red-600 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-3 transition-all backdrop-blur-md border border-white/10 hover:scale-105 text-lg"
                >
                  <Youtube size={20} />
                  Trailer
                </button>
              )}
              <button 
                onClick={toggleWatchlist}
                className={`px-8 py-3 rounded-lg font-bold flex items-center gap-3 transition-all backdrop-blur-md border border-white/10 hover:scale-105 text-lg ${
                  isSaved 
                    ? 'bg-primary border-primary text-white' 
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {isSaved ? <Check size={20} /> : <Plus size={20} />}
                {isSaved ? 'In Library' : 'Add to Library'}
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
                    onClick={() => setSelectedSeason(s)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      selectedSeason === s ? 'bg-primary text-white border-primary' : 'bg-white/5 text-gray-300 border-white/10'
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
                key={`season-${selectedSeason}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
              >
                {(() => {
                  const progressed = Object.entries(episodeProgress).sort((a, b) => b[1] - a[1])[0];
                  const autoFocusEp = progressed ? Number(progressed[0]) : 1;
                  return episodes.map(ep => {
                    const pct = episodeProgress[ep.episode_number] || 0;
                    const showBar = pct >= 2;
                    const completed = pct >= 90;
                    return (
                      <Focusable
                        key={ep.id}
                        as={motion.button}
                        onClick={() => handlePlayEpisode(selectedSeason, ep.episode_number)}
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
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {credits.cast.slice(0, 10).map((actor: any) => (
              <div key={actor.id} className="min-w-[100px] flex flex-col items-center gap-2 text-center">
                <div className="w-20 h-20 rounded-full overflow-hidden border border-white/10">
                  <img 
                    src={getImageUrl(actor.profile_path)} 
                    alt={actor.name}
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{actor.name}</p>
                  <p className="text-xs text-gray-400 leading-tight">{actor.character}</p>
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
