import React, { memo, useState } from 'react';
import { Media, MediaDetails } from '../types';
import { getImageUrl, getVideos } from '../services/tmdb';
import { findBestTrailer } from '../utils/videoUtils';
import { useNavigate } from 'react-router-dom';
import { Play, Plus, Check, Star, Youtube } from 'lucide-react';
import Focusable from './Focusable';
import { usePlayer } from '../context/PlayerContext';
import { useWatchlist } from '../hooks/useWatchlist';
import TrailerModal from './TrailerModal';

interface MediaCardProps {
  media: Media;
  onClick?: () => void;
}

interface SavedMediaWithProgress extends Media {
  progress?: {
    watched: number;
    duration: number;
    percentage: number;
    season?: number;
    episode?: number;
  };
}

const MediaCard: React.FC<MediaCardProps> = memo(({ media, onClick }) => {
  const { isSaved, toggleWatchlist } = useWatchlist(media);
  const { play } = usePlayer();
  const navigate = useNavigate();
  const [isFocused, setIsFocused] = useState(false);
  
  // Trailer State
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  
  const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
  
  const progress = (media as SavedMediaWithProgress).progress;
  const hasProgress = progress && progress.percentage > 0 && progress.percentage < 95; // Don't show if almost finished (credits)

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (mediaType === 'tv') {
          play(media as unknown as MediaDetails, progress?.season || 1, progress?.episode || 1);
      } else {
          play(media as unknown as MediaDetails);
      }
    } catch (err) {
      // console.error('Failed to play media:', err);
    }
  };

  const handlePlayTrailer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      if (trailerKey) {
        setShowTrailer(true);
        return;
      }

      const videos = await getVideos(mediaType as 'movie' | 'tv', media.id);
      const trailer = findBestTrailer(videos);
      
      if (trailer) {
        setTrailerKey(trailer.key);
        setShowTrailer(true);
      }
    } catch (e) {
      // console.error('Failed to fetch trailer', e);
    }
  };

  // Prefetch trailer on hover
  const handleMouseEnter = () => {
    if (!trailerKey) {
       getVideos(mediaType as 'movie' | 'tv', media.id).then(videos => {
         const trailer = findBestTrailer(videos);
         if (trailer) {
           setTrailerKey(trailer.key);
           // Prefetch the actual video URL if backend supports it
           if (window.ipcRenderer) {
              window.ipcRenderer.invoke('trailer-prefetch', trailer.key).catch(() => {});
           }
         }
       }).catch(() => {});
    }
  };

  return (
    <>
      <Focusable
      className="relative aspect-2/3 rounded-xl overflow-hidden bg-surface group cursor-pointer shadow-lg ring-1 ring-white/5 transition-transform duration-300 hover:scale-105 hover:z-10 hover:shadow-[0_20px_25px_-5px_rgb(0_0_0/0.5),0_0_20px_rgba(124,58,237,0.3)]"
      activeClassName="ring-4 ring-primary scale-105 z-10 shadow-[0_20px_25px_-5px_rgb(0_0_0/0.5),0_0_20px_rgba(124,58,237,0.3)]"
      onClick={() => {
        if (onClick) onClick();
        navigate(`/details/${mediaType}/${media.id}`, { state: media });
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onMouseEnter={handleMouseEnter}
    >
      <div className="block w-full h-full relative">
        <img
          src={getImageUrl(media.poster_path, 'w500')}
          srcSet={`
            ${getImageUrl(media.poster_path, 'w342')} 342w,
            ${getImageUrl(media.poster_path, 'w500')} 500w,
            ${getImageUrl(media.poster_path, 'w780')} 780w
          `}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          alt={media.title || media.name}
          className="w-full h-full object-cover bg-gray-900"
          loading="lazy"
          decoding="async"
        />
        
        {/* Progress Bar (Always visible if exists) */}
        {hasProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50 z-20">
            <div 
              className="h-full bg-linear-to-r from-primary to-purple-500 shadow-[0_0_10px_rgba(124,58,237,0.7)]" 
              style={{ width: `${progress.percentage}%` }} 
            />
          </div>
        )}

        {/* TV Show Episode Badge */}
        {hasProgress && progress.season && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-[10px] font-bold text-white z-20">
            S{progress.season} E{progress.episode}
          </div>
        )}
        
        {/* Hover Overlay */}
        <div className={`absolute inset-0 bg-linear-to-t from-black via-black/90 to-transparent transition-opacity duration-300 flex flex-col justify-end p-4 ${isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <h3 className="text-white font-bold text-lg truncate leading-tight mb-1 drop-shadow-md pr-2">
            {media.title || media.name}
          </h3>
          
          <div className="flex items-center justify-between text-xs text-gray-300 mb-3 whitespace-nowrap">
            <div className="flex items-center gap-1">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              <span>{media.vote_average.toFixed(1)}</span>
            </div>
            <span className="bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm">
              {new Date(media.release_date || media.first_air_date || '').getFullYear() || 'N/A'}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1 overflow-x-auto scrollbar-hide shrink-0 pb-1">
            <button 
              onClick={handlePlayClick}
              className="flex-1 bg-linear-to-r from-primary to-purple-600 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all duration-300 text-sm shadow-[0_0_15px_rgba(124,58,237,0.4)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play size={14} fill="currentColor" /> {hasProgress ? 'Resume' : 'Play'}
            </button>
            <button
              onClick={handlePlayTrailer}
              className="p-2.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-white/20 transition-colors shrink-0"
              title="Watch Trailer"
            >
              <Youtube size={16} />
            </button>
            <button
              onClick={toggleWatchlist}
              className="p-2.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-white/20 transition-colors shrink-0"
              title={isSaved ? "Remove from Library" : "Add to Library"}
            >
              {isSaved ? <Check size={16} /> : <Plus size={16} />}
            </button>
          </div>
        </div>
      </div>
    </Focusable>
    {/* Trailer Modal */}
    {showTrailer && trailerKey && (
      <TrailerModal 
        videoKey={trailerKey} 
        title={media.title || media.name}
        onClose={() => setShowTrailer(false)} 
      />
    )}
    </>
  );
});

export default MediaCard;
