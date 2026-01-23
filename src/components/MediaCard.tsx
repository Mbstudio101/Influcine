import React from 'react';
import { Media } from '../types';
import { getImageUrl } from '../services/tmdb';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Plus, Check, Star } from 'lucide-react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

interface MediaCardProps {
  media: Media;
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

const MediaCard: React.FC<MediaCardProps> = ({ media }) => {
  const savedItems = useLiveQuery(() => db.watchlist.toArray());
  const savedIds = new Set(savedItems?.map(i => i.id));
  const isSaved = savedIds.has(media.id);
  const navigate = useNavigate();
  
  const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
  
  const progress = (media as SavedMediaWithProgress).progress;
  const hasProgress = progress && progress.percentage > 0 && progress.percentage < 95; // Don't show if almost finished (credits)

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isSaved) {
        await db.watchlist.delete(media.id);
      } else {
        await db.watchlist.add({ ...media, savedAt: Date.now() });
      }
    } catch (error) {
      console.error('Failed to save media:', error);
    }
  };

  return (
    <motion.div
      className="relative aspect-2/3 rounded-xl overflow-hidden bg-surface group cursor-pointer shadow-lg ring-1 ring-white/5"
      whileHover={{ scale: 1.05, zIndex: 10, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.5), 0 0 20px rgba(124,58,237,0.3)" }}
      transition={{ duration: 0.3 }}
      onClick={() => navigate(`/details/${mediaType}/${media.id}`)}
    >
      <div className="block w-full h-full relative">
        <img
          src={getImageUrl(media.poster_path)}
          alt={media.title || media.name}
          className="w-full h-full object-cover"
          loading="lazy"
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
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
          <h3 className="text-white font-bold text-lg line-clamp-2 leading-tight mb-1 drop-shadow-md">
            {media.title || media.name}
          </h3>
          
          <div className="flex items-center justify-between text-xs text-gray-300 mb-3">
            <div className="flex items-center gap-1">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              <span>{media.vote_average.toFixed(1)}</span>
            </div>
            <span className="bg-white/10 px-1.5 py-0.5 rounded">
              {new Date(media.release_date || media.first_air_date || '').getFullYear() || 'N/A'}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <Link 
              to={`/watch/${mediaType}/${media.id}`}
              className="flex-1 bg-white text-black py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all duration-300 text-sm shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                // We don't overwrite history here, just navigate
              }}
            >
              <Play size={14} fill="currentColor" /> {hasProgress ? 'Resume' : 'Play'}
            </Link>
            <button
              onClick={handleSave}
              className="p-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-white/20 transition-colors"
              title={isSaved ? "Remove from Library" : "Add to Library"}
            >
              {isSaved ? <Check size={16} /> : <Plus size={16} />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MediaCard;
