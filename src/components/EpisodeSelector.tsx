import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Clock, ChevronDown, ImageOff } from 'lucide-react';
import { getSeasonDetails, getImageUrl } from '../services/tmdb';

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime: number;
  air_date: string;
  vote_average: number;
}

interface EpisodeSelectorProps {
  showId: number;
  currentSeason: number;
  currentEpisode: number;
  totalSeasons: number;
  onEpisodeSelect: (season: number, episode: number) => void;
  onClose: () => void;
  isOpen: boolean;
}

const EpisodeSelector: React.FC<EpisodeSelectorProps> = ({
  showId,
  currentSeason,
  currentEpisode,
  totalSeasons,
  onEpisodeSelect,
  onClose,
  isOpen
}) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchEpisodes = async () => {
      setLoading(true);
      try {
        const data = await getSeasonDetails(showId, selectedSeason);
        setEpisodes(data.episodes);
      } catch (error) {
        console.error('Failed to fetch episodes:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchEpisodes();
    }
  }, [showId, selectedSeason, isOpen]);

  // Sync internal state if props change
  useEffect(() => {
    setSelectedSeason(currentSeason);
  }, [currentSeason]);

  const handleEpisodeClick = (ep: Episode) => {
    onEpisodeSelect(selectedSeason, ep.episode_number);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 z-60 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={onClose}
          />

          {/* Side Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-black/80 backdrop-blur-2xl border-l border-white/10 z-60 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-linear-to-b from-white/5 to-transparent">
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Episodes
                <span className="text-primary text-sm font-bold uppercase tracking-widest px-2 py-1 bg-primary/20 rounded-md">
                  S{selectedSeason}
                </span>
              </h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Season Selector */}
            <div className="px-6 py-4 shrink-0 relative z-10">
              <button
                onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white transition-all font-medium"
              >
                <span>Season {selectedSeason}</span>
                <ChevronDown 
                  size={20} 
                  className={`transition-transform duration-300 ${isSeasonDropdownOpen ? 'rotate-180' : ''}`} 
                />
              </button>

              <AnimatePresence>
                {isSeasonDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute left-6 right-6 top-full mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-20"
                  >
                    {Array.from({ length: totalSeasons }, (_, i) => i + 1).map((seasonNum) => (
                      <button
                        key={seasonNum}
                        onClick={() => {
                          setSelectedSeason(seasonNum);
                          setIsSeasonDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-primary/20 transition-colors flex items-center justify-between ${
                          selectedSeason === seasonNum ? 'bg-primary/10 text-primary font-bold' : 'text-gray-300'
                        }`}
                      >
                        Season {seasonNum}
                        {selectedSeason === seasonNum && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Episodes List */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-textSecondary text-sm">Loading episodes...</p>
                </div>
              ) : (
                episodes.map((ep, index) => {
                  const isCurrent = selectedSeason === currentSeason && ep.episode_number === currentEpisode;
                  
                  return (
                    <motion.div
                      key={ep.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleEpisodeClick(ep)}
                      className={`group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer ${
                        isCurrent 
                          ? 'bg-primary/10 border-primary/50 shadow-[0_0_20px_rgba(124,58,237,0.2)]' 
                          : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex gap-4 p-3">
                        {/* Thumbnail */}
                        <div className="relative w-32 aspect-video shrink-0 rounded-lg overflow-hidden bg-black/50">
                          {ep.still_path ? (
                            <img 
                              src={getImageUrl(ep.still_path, 'w500')} 
                              alt={ep.name}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20">
                              <ImageOff size={24} />
                            </div>
                          )}
                          
                          {/* Play Overlay */}
                          <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            {isCurrent ? (
                              <div className="flex gap-1">
                                <div className="w-1 h-4 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1 h-4 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1 h-4 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <Play size={14} fill="white" className="ml-0.5 text-white" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 py-1 flex flex-col justify-center">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-primary tracking-wider">EP {ep.episode_number}</span>
                            {ep.runtime && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-1 bg-black/30 px-1.5 py-0.5 rounded-sm">
                                <Clock size={10} /> {ep.runtime}m
                              </span>
                            )}
                          </div>
                          <h3 className={`font-bold text-sm leading-tight mb-1 truncate ${isCurrent ? 'text-primary' : 'text-white group-hover:text-primary transition-colors'}`}>
                            {ep.name}
                          </h3>
                          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                            {ep.overview}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EpisodeSelector;
