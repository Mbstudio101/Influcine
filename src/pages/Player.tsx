import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Layers, PlayCircle } from 'lucide-react';
import { getDetails } from '../services/tmdb';
import { MediaDetails } from '../types';
import EpisodeSelector from '../components/EpisodeSelector';
import InflucinePlayer from '../components/InflucinePlayer';
import { db } from '../db';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/useAuth';
import Focusable from '../components/Focusable';
import { awardXP, unlockAchievement, updateWatchStats } from '../services/achievements';
import { recordSourceSuccess, recordSourceFailure, getBestSource } from '../services/sourceMemory';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '../context/toast';

const Player: React.FC = () => {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const navigate = useNavigate();
  const { themeColor, autoplay: autoPlayNext } = useSettings();
  const { profile } = useAuth();
  const { showToast } = useToast();
  
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [isNativePlayer, setIsNativePlayer] = useState(false);
  const [verifiedSource, setVerifiedSource] = useState<string | null>(null);
  
  const hasResumedRef = useRef(false);
  const lastXPAwardTimeRef = useRef(0);
  const lastStatUpdateTimeRef = useRef(0);
  const accumulatedTimeRef = useRef(0);

  const getSrc = useCallback(() => {
    const theme = themeColor.replace('#', '');
    if (type === 'movie') {
      return `https://vidfast.pro/movie/${id}?autoPlay=true&theme=${theme}`;
    }
    return `https://vidfast.pro/tv/${id}/${season}/${episode}?autoPlay=true&theme=${theme}&nextButton=true&autoNext=${autoPlayNext}`;
  }, [themeColor, type, id, season, episode, autoPlayNext]);

  // Check for verified source
  useEffect(() => {
    const checkSource = async () => {
      if (id) {
        const best = await getBestSource(parseInt(id), type === 'tv' ? season : 0, type === 'tv' ? episode : 0);
        if (best && best.isVerified) {
          setVerifiedSource(best.provider);
        } else {
          setVerifiedSource(null);
        }
      }
    };
    checkSource();
  }, [id, type, season, episode]);

  // Load saved progress
  useEffect(() => {
    const loadProgress = async () => {
      if (type && id) {
        try {
          const saved = await db.history.get(parseInt(id));
          if (saved?.progress) {
            // Restore season/episode for TV shows
            if (type === 'tv' && saved.progress.season && saved.progress.episode) {
              setSeason(saved.progress.season);
              setEpisode(saved.progress.episode);
            }
            
            // Set start time if not finished (e.g. < 95%)
            if (saved.progress.percentage < 95) {
              setStartTime(saved.progress.watched);
            }
          }
        } catch (error) {
          console.error('Failed to load progress:', error);
        }
      }
    };
    loadProgress();
  }, [type, id]);

  // Handle Player Events & Progress Tracking
  useEffect(() => {
    const vidfastOrigins = [
      'https://vidfast.pro',
      'https://vidfast.in',
      'https://vidfast.io',
      'https://vidfast.me',
      'https://vidfast.net',
      'https://vidfast.pm',
      'https://vidfast.xyz'
    ];

    const handleMessage = async (event: MessageEvent) => {
      if (!vidfastOrigins.includes(event.origin) || !event.data) return;

      // Handle Resume (Seek to start time)
      if (event.data.type === 'PLAYER_EVENT') {
        const { event: playerEvent, currentTime, duration } = event.data.data;
        
        // --- Play Event: Check start time achievements ---
        if (playerEvent === 'play') {
          if (startTime > 0 && !hasResumedRef.current) {
            // Send seek command
            const iframe = document.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                command: 'seek',
                time: startTime
              }, '*');
              hasResumedRef.current = true;
            }
          }

          // Check Sleep/Time Achievements
          if (profile?.id) {
            const hour = new Date().getHours();
            // Night Owl: 00:00 - 04:00
            if (hour >= 0 && hour < 4) {
               await unlockAchievement(profile.id, 'night_owl', 1);
            }
          }

          // Record Source Success (Memory Agent)
          if (id) {
             await recordSourceSuccess(
               parseInt(id), 
               'VidFast', 
               getSrc(), 
               type === 'tv' ? season : 0, 
               type === 'tv' ? episode : 0
             );
          }
        }

        // --- TimeUpdate: XP & Progress ---
        if (playerEvent === 'timeupdate' && profile?.id) {
            // XP Accumulation (every 5 mins = 300s)
            // We use currentTime to approximate continuous watching if they don't skip
            // A better way is measuring real elapsed wall-clock time, but this is simpler for now
            if (currentTime - lastXPAwardTimeRef.current > 300) {
               await awardXP(profile.id, 20); // 20 XP per 5 mins
               lastXPAwardTimeRef.current = currentTime;
            }

            // Stats Accumulation (every 1 min = 60s)
            const delta = currentTime - lastStatUpdateTimeRef.current;
            if (delta > 0 && delta < 5) {
               accumulatedTimeRef.current += delta;
            }
            lastStatUpdateTimeRef.current = currentTime;

            if (accumulatedTimeRef.current >= 60) {
               await updateWatchStats(profile.id, { minutesWatched: 1 });
               accumulatedTimeRef.current -= 60;
            }
        }

        if (['pause', 'timeupdate'].includes(playerEvent)) {
          // Save progress every timeupdate or pause
          const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
          
          try {
            if (details) {
                await db.history.put({
                ...details,
                savedAt: Date.now(),
                progress: {
                    watched: currentTime,
                    duration: duration,
                    percentage: percentage,
                    lastUpdated: Date.now(),
                    season: type === 'tv' ? season : undefined,
                    episode: type === 'tv' ? episode : undefined
                }
                });
                if (type === 'tv' && profile?.id) {
                  await db.episodeProgress.put({
                    profileId: profile.id,
                    showId: parseInt(id as string),
                    season,
                    episode,
                    watchedSeconds: currentTime,
                    durationSeconds: duration,
                    percentage,
                    lastUpdated: Date.now()
                  });
                }
            }
          } catch (err) {
            console.error('Error saving progress:', err);
          }
        }

        // --- Ended: Completion Bonuses ---
        if (playerEvent === 'ended' && profile?.id) {
             // 1. Award Bonus XP
             const bonus = type === 'movie' ? 150 : 75;
             await awardXP(profile.id, bonus);

             // Track Movies/Series Watched
             if (type === 'movie') {
                 await updateWatchStats(profile.id, { movieCompleted: true });
             } else {
                 await updateWatchStats(profile.id, { seriesCompleted: true });
             }

             // 2. Track Binge Watching (Session Storage)
             let sessionCount = parseInt(sessionStorage.getItem('influcine_session_watch_count') || '0');
             sessionCount++;
             sessionStorage.setItem('influcine_session_watch_count', sessionCount.toString());
             
             await unlockAchievement(profile.id, 'binge_watcher', sessionCount);

             // 3. Track Early Bird (4AM - 6AM finish)
             const hour = new Date().getHours();
             if (hour >= 4 && hour < 6) {
                 await unlockAchievement(profile.id, 'early_bird', 1);
             }

             // 4. Taste Achievements
             if (details?.genres) {
                 const isDrama = details.genres.some(g => g.name.toLowerCase().includes('drama'));
                 if (isDrama) {
                     // Track total dramas watched
                     const historyCount = await db.history.filter(h => 
                        (h.media_type === 'movie' || h.media_type === 'tv') &&
                        (h.genres?.some(g => g.name.toLowerCase().includes('drama')) || false)
                     ).count();
                     
                     await unlockAchievement(profile.id, 'drama_queen', historyCount); 
                 }
             }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [details, type, season, episode, startTime, profile, getSrc, id]);

  useEffect(() => {
    const fetchDetails = async () => {
      if (type && id) {
        try {
          const data = await getDetails(type, parseInt(id));
          setDetails(data);
          setDetailsError(null);
        } catch (error) {
          console.error('Failed to fetch details:', error);
          const message = 'We could not load this title right now. Please check your connection and try again.';
          setDetailsError(message);
          showToast(message, 'error');
        }
      }
    };
    fetchDetails();
  }, [type, id, showToast]);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const show = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    const handleMouseMove = () => show();
    const handleKeyDown = () => show();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, []);

  if (!type || !id) return null;

  if (detailsError && !details && !isNativePlayer) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-2xl font-bold text-white mb-3">Playback unavailable</h1>
        <p className="text-sm text-gray-300 max-w-md mb-6">
          {detailsError}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
          >
            Retry
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const handleEpisodeSelect = (newSeason: number, newEpisode: number) => {
    setSeason(newSeason);
    setEpisode(newEpisode);
  };

  if (isNativePlayer) {
    return (
      <InflucinePlayer
        src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
        title={details?.title || details?.name || 'Playing Video'}
        poster={details?.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : undefined}
        onBack={() => setIsNativePlayer(false)}
        startTime={startTime}
        onTimeUpdate={() => {
          // Optional: Track native player progress
        }}
      />
    );
  }

  const handleReportIssue = async () => {
    if (id) {
      await recordSourceFailure(
        parseInt(id), 
        'VidFast', 
        type === 'tv' ? season : 0, 
        type === 'tv' ? episode : 0
      );
      // Force reload or just notify user?
      // For now, just reset verified source
      setVerifiedSource(null);
      // Ideally we would trigger a re-render or try next source
      // But we only have one source provider hardcoded for now (VidFast)
      // So we just log it.
      showToast('Issue reported. We will try to find a better source next time.', 'info');
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden group">
      {/* Hover Zone - Top 15% of screen to detect mouse and show controls */}
      <div 
        className="absolute top-0 left-0 right-0 h-[15vh] z-30"
        onMouseEnter={() => setShowControls(true)}
      />

      {/* Header Controls */}
      <div 
        className={`absolute top-0 left-0 right-0 p-6 z-40 transition-opacity duration-500 bg-linear-to-b from-black/80 to-transparent pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-4">
            <Focusable
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors group/btn cursor-pointer"
              activeClassName="ring-2 ring-primary rounded-lg bg-white/10 p-1"
              autoFocus
            >
              <div className="p-2 rounded-full bg-white/10 backdrop-blur-md group-hover/btn:bg-primary transition-all">
                <ArrowLeft size={24} />
              </div>
              <span className="font-medium text-lg tracking-wide">Back to Browse</span>
            </Focusable>

            {verifiedSource && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30 backdrop-blur-md">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-xs font-bold text-green-300 uppercase tracking-wider">Verified Source</span>
              </div>
            )}

            <Focusable
              onClick={handleReportIssue}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 backdrop-blur-md transition-all cursor-pointer group/report"
              activeClassName="ring-2 ring-red-500"
            >
              <AlertTriangle size={16} className="text-red-400 group-hover/report:text-red-300" />
              <span className="text-xs font-bold text-red-400 group-hover/report:text-red-300">Report Issue</span>
            </Focusable>

            <Focusable
              onClick={() => setIsNativePlayer(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-primary/20 backdrop-blur-md border border-white/10 transition-all group/native cursor-pointer"
              activeClassName="ring-2 ring-primary scale-105"
            >
              <PlayCircle size={20} className="text-primary group-hover/native:text-white transition-colors" />
              <span className="text-sm font-bold text-white/90">Try Native Player (4K Demo)</span>
            </Focusable>
          </div>

          {type === 'tv' && details && (
            <Focusable
              onClick={() => setIsEpisodeSelectorOpen(true)}
              className="flex items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 transition-all hover:scale-105 group/ep cursor-pointer"
              activeClassName="ring-2 ring-primary scale-105"
            >
              <div className="flex flex-col items-end leading-none">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Playing</span>
                <span className="text-sm font-bold text-white">S{season} E{episode}</span>
              </div>
              <div className="w-px h-8 bg-white/10 mx-1" />
              <Layers size={20} className="text-primary group-hover/ep:text-white transition-colors" />
              <span className="font-bold">Episodes</span>
            </Focusable>
          )}
        </div>
      </div>

      {/* Player Container */}
      <div className="flex-1 w-full h-full relative bg-black">
        <iframe
          src={getSrc()}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay; encrypted-media"
          title="VidFast Player"
        />
      </div>

      {/* Next Episode Button (Floating) - Optional quick access */}
      {type === 'tv' && showControls && !isEpisodeSelectorOpen && (
        <div className="absolute bottom-10 right-10 z-40 animate-in fade-in slide-in-from-bottom-10 duration-500">
          <Focusable 
            onClick={() => setEpisode(e => e + 1)}
            className="group flex items-center gap-3 bg-primary/90 hover:bg-primary text-white px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(124,58,237,0.4)] hover:shadow-[0_0_40px_rgba(124,58,237,0.6)] backdrop-blur-md transition-all hover:scale-105 cursor-pointer"
            activeClassName="ring-4 ring-white scale-110"
          >
            <span className="font-bold text-lg">Next Episode</span>
            <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
          </Focusable>
        </div>
      )}

      {/* Episode Selector Overlay */}
      {type === 'tv' && details && (
        <EpisodeSelector
          showId={parseInt(id)}
          currentSeason={season}
          currentEpisode={episode}
          totalSeasons={details.number_of_seasons || 1}
          onEpisodeSelect={handleEpisodeSelect}
          isOpen={isEpisodeSelectorOpen}
          onClose={() => setIsEpisodeSelectorOpen(false)}
        />
      )}
    </div>
  );
};

export default Player;
