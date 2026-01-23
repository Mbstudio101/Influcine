import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Layers, PlayCircle } from 'lucide-react';
import { getDetails } from '../services/tmdb';
import { MediaDetails } from '../types';
import EpisodeSelector from '../components/EpisodeSelector';
import InflucinePlayer from '../components/InflucinePlayer';
import { db } from '../db';
import { useSettings } from '../context/SettingsContext';
import Focusable from '../components/Focusable';

const Player: React.FC = () => {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const navigate = useNavigate();
  const { themeColor, autoplay: autoPlayNext } = useSettings();
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [isEpisodeSelectorOpen, setIsEpisodeSelectorOpen] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [isNativePlayer, setIsNativePlayer] = useState(false);
  const hasResumedRef = useRef(false);

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
        const { event: playerEvent } = event.data.data;
        
        if (playerEvent === 'play' && startTime > 0 && !hasResumedRef.current) {
          // Send seek command
          const iframe = document.querySelector('iframe');
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              command: 'seek',
              time: startTime
            }, '*');
            hasResumedRef.current = true;
            console.log('Resuming playback at', startTime);
          }
        }
      }

      if (event.data.type === 'PLAYER_EVENT' && details) {
        const { event: playerEvent, currentTime, duration } = event.data.data;
        
        if (['pause', 'timeupdate'].includes(playerEvent)) {
          // Save progress every timeupdate or pause
          // Calculate percentage
          const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
          
          try {
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
          } catch (err) {
            console.error('Error saving progress:', err);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [details, type, season, episode, startTime]);

  useEffect(() => {
    const fetchDetails = async () => {
      if (type && id) {
        try {
          const data = await getDetails(type, parseInt(id));
          setDetails(data);
        } catch (error) {
          console.error('Failed to fetch details:', error);
        }
      }
    };
    fetchDetails();
  }, [type, id]);

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

  const getSrc = () => {
    const theme = themeColor.replace('#', '');
    if (type === 'movie') {
      return `https://vidfast.pro/movie/${id}?autoPlay=true&theme=${theme}`;
    }
    return `https://vidfast.pro/tv/${id}/${season}/${episode}?autoPlay=true&theme=${theme}&nextButton=true&autoNext=${autoPlayNext}`;
  };

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
