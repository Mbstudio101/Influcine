import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SavedMedia } from '../db';
import MediaCard from '../components/MediaCard';
import Focusable from '../components/Focusable';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../services/tmdb';
import { Play, Search, Tv, Film, Layers, ChevronRight, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Watchlist: React.FC = () => {
  const watchlist = useLiveQuery(() => db.watchlist.orderBy('savedAt').reverse().toArray());
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredItem, setFeaturedItem] = useState<SavedMedia | null>(null);
  const navigate = useNavigate();

  // Set a featured item randomly from the watchlist on load
  useEffect(() => {
    if (watchlist && watchlist.length > 0 && !featuredItem) {
      const random = watchlist[Math.floor(Math.random() * watchlist.length)];
      setFeaturedItem(random);
    } else if (watchlist?.length === 0) {
      setFeaturedItem(null);
    }
  }, [watchlist, featuredItem]);

  const filteredItems = useMemo(() => {
    if (!watchlist) return [];
    return watchlist.filter((item) => {
      const matchesFilter = filter === 'all' || item.media_type === filter;
      const matchesSearch = 
        (item.title || item.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [watchlist, filter, searchQuery]);

  const stats = useMemo(() => {
    if (!watchlist) return { total: 0, movies: 0, tv: 0 };
    return {
      total: watchlist.length,
      movies: watchlist.filter(i => i.media_type === 'movie').length,
      tv: watchlist.filter(i => i.media_type === 'tv').length
    };
  }, [watchlist]);

  const filterOptions: { id: 'all' | 'movie' | 'tv'; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'all', label: 'All', icon: Layers, count: stats.total },
    { id: 'movie', label: 'Movies', icon: Film, count: stats.movies },
    { id: 'tv', label: 'TV Shows', icon: Tv, count: stats.tv }
  ];

  if (!watchlist) return null;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden pb-20 scrollbar-hide">
      
      {/* Hero / Featured Section */}
      <AnimatePresence mode="wait">
        {featuredItem ? (
          <motion.div 
            key={featuredItem.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full h-[60vh] md:h-[70vh]"
          >
            <div className="absolute inset-0">
              <img
                src={getImageUrl(featuredItem.backdrop_path || featuredItem.poster_path, 'original')}
                alt={featuredItem.title || featuredItem.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
              <div className="absolute inset-0 bg-linear-to-r from-background via-background/80 to-transparent" />
            </div>

            <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 z-10 flex flex-col justify-end h-full">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="max-w-3xl"
              >
                <div className="flex items-center gap-3 mb-4 text-primary font-medium tracking-wider text-sm uppercase">
                  <span className="bg-primary/20 px-3 py-1 rounded-full border border-primary/20 backdrop-blur-md">
                    Featured in Library
                  </span>
                  {featuredItem.vote_average > 0 && (
                    <span className="flex items-center gap-1 text-yellow-400">
                      <Star size={14} fill="currentColor" /> {featuredItem.vote_average.toFixed(1)}
                    </span>
                  )}
                </div>
                
                <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight drop-shadow-2xl">
                  {featuredItem.title || featuredItem.name}
                </h1>
                
                <p className="text-gray-200 text-lg md:text-xl line-clamp-2 md:line-clamp-3 mb-8 max-w-2xl font-medium drop-shadow-md">
                  {featuredItem.overview}
                </p>
                
                <div className="flex items-center gap-4">
                  <Focusable
                    as="button"
                    onClick={() => navigate(`/watch/${featuredItem.media_type}/${featuredItem.id}`)}
                    className="bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all hover:scale-105 shadow-[0_0_40px_rgba(124,58,237,0.4)] text-lg group"
                    activeClassName="ring-4 ring-primary/50 scale-105"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white text-white group-hover:text-primary transition-colors">
                      <Play fill="currentColor" size={20} className="ml-1" />
                    </div>
                    Watch Now
                  </Focusable>
                  
                  <Focusable
                    as="button"
                    onClick={() => navigate(`/details/${featuredItem.media_type}/${featuredItem.id}`)}
                    className="bg-white/5 hover:bg-white/10 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all border border-white/10 backdrop-blur-md hover:scale-105 text-lg"
                    activeClassName="ring-4 ring-white/50 scale-105"
                  >
                    Details <ChevronRight size={20} />
                  </Focusable>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <div className="w-full h-[40vh] flex flex-col items-center justify-center bg-linear-to-b from-primary/10 to-background border-b border-white/5">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-linear-to-r from-white to-gray-500">
              Your Library
            </h1>
            <p className="text-gray-400 text-lg">Your personal collection of movies and shows.</p>
          </div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 py-4 px-6 md:px-16 transition-all">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Filters */}
          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
            {filterOptions.map((f) => (
              <Focusable
                key={f.id}
                as="button"
                onClick={() => setFilter(f.id)}
                className={`relative px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                  filter === f.id 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                activeClassName="ring-2 ring-primary bg-white/10"
              >
                <f.icon size={16} />
                {f.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filter === f.id ? 'bg-black/20 text-white' : 'bg-white/10 text-gray-400'
                }`}>
                  {f.count}
                </span>
              </Focusable>
            ))}
          </div>

          {/* Search */}
          <div className="relative group w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-64 bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
            />
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="px-6 md:px-16 py-10">
        {watchlist.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
              <Layers className="text-gray-500" size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-3">Your library is empty</h2>
            <p className="text-gray-400 max-w-md mb-8">
              Start building your collection by adding movies and TV shows you love or want to watch later.
            </p>
            <Focusable
              as="button"
              onClick={() => navigate('/browse')}
              className="bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-primary hover:text-white transition-all shadow-lg"
              activeClassName="ring-4 ring-primary/50"
            >
              Browse Content
            </Focusable>
          </motion.div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No matches found for "{searchQuery}" in {filter !== 'all' ? filter : 'your library'}.</p>
            <button 
              onClick={() => { setSearchQuery(''); setFilter('all'); }}
              className="mt-4 text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <motion.div 
            layout
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8"
          >
            <AnimatePresence>
              {filteredItems.map((item) => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <MediaCard media={item} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Watchlist;
