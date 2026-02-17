import React, { memo, useState, useEffect } from 'react';
import { Media, MediaDetails } from '../types';
import { getImageUrl, getDetails } from '../services/tmdb';
import { useNavigate } from 'react-router-dom';
import { Play, Plus, Check, Star, Youtube, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import Focusable from './Focusable';
import { usePlayer } from '../context/PlayerContext';
import { useWatchlist } from '../hooks/useWatchlist';
import TrailerModal from './TrailerModal';
import { useTrailerPrefetch } from '../hooks/useTrailerPrefetch';
import { useAuth } from '../context/useAuth';
import { getPreference, togglePreference } from '../services/recommendationEngine';
import { db } from '../db';

interface MediaCardProps {
  media: Media;
  onClick?: () => void;
  variant?: 'poster' | 'backdrop';
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

const MediaCard: React.FC<MediaCardProps> = memo(({ media, onClick, variant = 'poster' }) => {
  const { isSaved, toggleWatchlist } = useWatchlist(media);
  const { play } = usePlayer();
  const navigate = useNavigate();
  const [isFocused, setIsFocused] = useState(false);

  const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
  const { trailerKey, prefetch, cancelPrefetch, fetchTrailerNow } = useTrailerPrefetch(media, mediaType as 'movie' | 'tv');

  const [showTrailer, setShowTrailer] = useState(false);

  const { profile } = useAuth();
  const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);

  useEffect(() => {
    if (profile?.id && media.id) {
      getPreference(profile.id, media.id).then(pref => {
        if (pref?.vote === 'like') setUserVote('like');
        else if (pref?.vote === 'dislike') setUserVote('dislike');
      });
    }
  }, [profile, media.id]);

  const handleVote = async (e: React.MouseEvent, vote: 'like' | 'dislike') => {
    e.stopPropagation();
    if (!profile?.id) return;

    if (userVote === vote) {
      setUserVote(null);
      await togglePreference(profile.id, media.id, vote, mediaType as 'movie' | 'tv');
    } else {
      setUserVote(vote);
      await togglePreference(profile.id, media.id, vote, mediaType as 'movie' | 'tv');
    }
  };

  const savedHistory = useLiveQuery(() => db.history.get(media.id), [media.id]);
  const savedProgress =
    savedHistory?.media_type === mediaType
      ? savedHistory.progress
      : undefined;

  const fallbackProgress = (media as SavedMediaWithProgress).progress;
  const progress = savedProgress ?? fallbackProgress;
  const progressPct = Math.max(0, Math.min(100, Math.round(progress?.percentage || 0)));
  const hasProgressBar = progressPct > 0;
  const hasResume = progressPct > 0 && progressPct < 95;

  const handlePlayClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const details = await getDetails(mediaType as 'movie' | 'tv', media.id);
      if (mediaType === 'tv') {
        play(details as unknown as MediaDetails, progress?.season || 1, progress?.episode || 1, progress?.watched || 0);
      } else {
        play(details as unknown as MediaDetails, undefined, undefined, progress?.watched || 0);
      }
    } catch (err) {
      console.error('Failed to fetch full media details, falling back to cached media:', err);
      try {
        if (mediaType === 'tv') {
          play(media as unknown as MediaDetails, progress?.season || 1, progress?.episode || 1, progress?.watched || 0);
        } else {
          play(media as unknown as MediaDetails, undefined, undefined, progress?.watched || 0);
        }
      } catch (playErr) {
        console.error('Failed to play media:', playErr);
      }
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

      const key = await fetchTrailerNow();

      if (key) {
        setShowTrailer(true);
      }
    } catch (e) {
      console.error('Failed to fetch trailer', e);
    }
  };

  const handleMouseEnter = () => {
    prefetch();
  };

  const handleMouseLeave = () => {
    cancelPrefetch();
  };

  const imagePath = variant === 'backdrop' ? media.backdrop_path || media.poster_path : media.poster_path;

  return (
    <>
      <Focusable
        className={`relative overflow-hidden bg-surface group cursor-pointer ring-1 ring-white/10 transition-transform duration-300 hover:scale-[1.03] hover:z-10 hover:shadow-[0_16px_30px_rgba(0,0,0,0.45)] ${
          variant === 'backdrop' ? 'aspect-video rounded-2xl' : 'aspect-2/3 rounded-xl'
        }`}
        activeClassName="ring-4 ring-primary scale-[1.03] z-10"
        onClick={() => {
          if (onClick) onClick();
          navigate(`/details/${mediaType}/${media.id}`, { state: media });
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="block w-full h-full relative">
          <img
            src={getImageUrl(imagePath, variant === 'backdrop' ? 'w780' : 'w500')}
            srcSet={
              variant === 'backdrop'
                ? `${getImageUrl(imagePath, 'w300')} 300w, ${getImageUrl(imagePath, 'w780')} 780w, ${getImageUrl(imagePath, 'w1280')} 1280w`
                : `${getImageUrl(imagePath, 'w342')} 342w, ${getImageUrl(imagePath, 'w500')} 500w, ${getImageUrl(imagePath, 'w780')} 780w`
            }
            sizes={variant === 'backdrop' ? '(max-width: 1024px) 70vw, 25vw' : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw'}
            alt={media.title || media.name}
            className="w-full h-full object-cover bg-gray-900"
            loading="lazy"
            decoding="async"
          />

          {hasProgressBar && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/55 z-20">
              <div className="h-full bg-linear-to-r from-[#ff4fa3] via-[#ff7ab6] to-[#7d7bff]" style={{ width: `${progressPct}%` }} />
            </div>
          )}

          {hasResume && progress?.season && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-[10px] font-bold text-white z-20">
              S{progress.season} E{progress.episode}
            </div>
          )}

          <div className={`absolute inset-0 bg-linear-to-t from-black via-black/85 to-transparent transition-opacity duration-300 flex flex-col justify-end ${variant === 'backdrop' ? 'p-3' : 'p-4'} ${isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <h3 className={`text-white font-semibold truncate leading-tight mb-1 drop-shadow-md pr-2 ${variant === 'backdrop' ? 'text-sm md:text-base' : 'text-lg'}`}>
              {media.title || media.name}
            </h3>

            <div className="flex items-center justify-between text-xs text-gray-300 mb-2 whitespace-nowrap">
              <div className="flex items-center gap-1">
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                <span>{(media.vote_average || 0).toFixed(1)}</span>
              </div>

              {(media.audio_format === 'atmos') && (
                <span className="bg-black/45 border border-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm text-[9px] font-bold tracking-wider text-white">
                  ATMOS
                </span>
              )}

              <span className="bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-sm">
                {new Date(media.release_date || media.first_air_date || '').getFullYear() || 'N/A'}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1 overflow-x-auto scrollbar-hide shrink-0 pb-1">
              <button
                onClick={handlePlayClick}
                className="flex-1 bg-linear-to-r from-[#ff4fa3] via-[#ff7ab6] to-[#7d7bff] text-white py-2 rounded-xl font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition-all duration-300 text-xs md:text-sm whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play size={14} fill="currentColor" /> {hasResume ? 'Resume' : 'Play'}
              </button>

              <button
                onClick={(e) => handleVote(e, 'like')}
                className={`p-2.5 backdrop-blur-md border border-white/10 rounded-xl transition-colors shrink-0 ${
                  userVote === 'like' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="Like"
              >
                <ThumbsUp size={14} className={userVote === 'like' ? 'fill-current' : ''} />
              </button>

              <button
                onClick={(e) => handleVote(e, 'dislike')}
                className={`p-2.5 backdrop-blur-md border border-white/10 rounded-xl transition-colors shrink-0 ${
                  userVote === 'dislike' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title="Dislike"
              >
                <ThumbsDown size={14} className={userVote === 'dislike' ? 'fill-current' : ''} />
              </button>

              <button
                onClick={handlePlayTrailer}
                className="p-2.5 bg-[rgba(255,179,71,0.14)] backdrop-blur-md border border-[rgba(255,179,71,0.45)] rounded-xl text-white hover:bg-[rgba(255,179,71,0.24)] transition-colors shrink-0"
                title="Watch Trailer"
              >
                <Youtube size={14} />
              </button>

              <button
                onClick={toggleWatchlist}
                className="p-2.5 bg-[rgba(94,234,212,0.14)] backdrop-blur-md border border-[rgba(94,234,212,0.45)] rounded-xl text-white hover:bg-[rgba(94,234,212,0.24)] transition-colors shrink-0"
                title={isSaved ? 'Remove from Library' : 'Add to Library'}
              >
                {isSaved ? <Check size={14} /> : <Plus size={14} />}
              </button>
            </div>
          </div>
        </div>
      </Focusable>

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
