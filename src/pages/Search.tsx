import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { db } from '../db';
import { VideoAgent } from '../services/VideoAgent';
import { useDebounce } from '../hooks/useDebounce';
import { useSearchFilter, FilterType } from '../hooks/useSearchFilter';
import { Search as SearchIcon, Zap, Clock, X, Film, Tv, LayoutGrid } from 'lucide-react';
import Focusable from '../components/Focusable';
import MediaCard from '../components/MediaCard';
import VirtualMediaGrid from '../components/VirtualMediaGrid';
import { useToast } from '../context/toast';
import { motion } from 'framer-motion';

const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);
  const { showToast } = useToast();
  
  const recentSearches = useLiveQuery(
    () => db.recentSearches.orderBy('timestamp').reverse().limit(10).toArray()
  );

  const { data: searchData, isLoading: loading, error } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return { results: [], source: 'none' };
      return VideoAgent.search(debouncedQuery);
    },
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
    placeholderData: keepPreviousData,
  });

  // Use the new hook for filtering
  const { filterType, setFilterType, filteredResults, counts } = useSearchFilter(searchData?.results || []);
  const isCached = searchData?.source === 'cache';

  const saveToHistory = useCallback(async (searchTerm: string) => {
    const normalized = searchTerm.trim();
    if (normalized.length <= 1) return;

    try {
      await db.transaction('rw', db.recentSearches, async () => {
        const existing = await db.recentSearches.where('query').equals(normalized).first();
        if (existing) {
          await db.recentSearches.update(existing.id!, { timestamp: Date.now() });
        } else {
          await db.recentSearches.add({ query: normalized, timestamp: Date.now() });
        }
      });
    } catch (e) {
      console.warn('Recent search save failed:', e);
    }
  }, []);

  // Handle errors via toast
  useEffect(() => {
    if (error) {
      console.error('Search failed:', error);
      showToast('Search failed. Please check your connection and try again.', 'error');
    }
  }, [error, showToast]);

  const handleRecentClick = (term: string) => {
    setQuery(term);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      saveToHistory(query);
    }
  };

  const clearRecentSearches = async () => {
    await db.recentSearches.clear();
  };

  const removeRecentSearch = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await db.recentSearches.delete(id);
  };

  const FilterButton = ({ type, label, icon: Icon }: { type: FilterType, label: string, icon: React.ElementType }) => (
    <button
      onClick={() => setFilterType(type)}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
        filterType === type 
          ? 'bg-primary text-white shadow-lg shadow-primary/25 ring-1 ring-primary/50' 
          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
      }`}
    >
      <Icon size={16} />
      <span>{label}</span>
      {counts[type] > 0 && (
        <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
          filterType === type ? 'bg-white/20' : 'bg-black/20'
        }`}>
          {counts[type]}
        </span>
      )}
    </button>
  );

  const SearchHeader = (
    <div className="flex-none pt-24 px-10 pb-4 z-20 bg-gradient-to-b from-black via-black/80 to-transparent">
        <div className="max-w-3xl mx-auto relative group">
          <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors duration-300" size={24} />
          <Focusable
            as="input"
            type="text"
            placeholder="Search for movies and TV shows..."
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-white/5 backdrop-blur-xl border border-white/10 text-white pl-14 pr-6 py-5 rounded-2xl text-xl focus:outline-none focus:ring-2 focus:ring-[rgba(255,79,163,0.55)] shadow-[0_0_20px_rgba(255,79,163,0.12)] focus:shadow-[0_0_40px_rgba(255,122,182,0.4)] placeholder-gray-500 transition-all duration-300"
            autoFocus
            activeClassName="ring-2 ring-primary shadow-[0_0_40px_rgba(255,122,182,0.4)]"
          />
          {isCached && !loading && (
             <div className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-400 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20" title="Served from intelligent cache">
                <Zap size={12} fill="currentColor" />
                <span>Fast</span>
             </div>
          )}
        </div>

        {/* Filter Bar */}
        {!loading && query && !error && (counts.all > 0) && (
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-3 mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <FilterButton type="all" label="All Results" icon={LayoutGrid} />
            <FilterButton type="movie" label="Movies" icon={Film} />
            <FilterButton type="tv" label="TV Shows" icon={Tv} />
          </div>
        )}
    </div>
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {SearchHeader}
      
      <div className="flex-1 min-h-0 relative">
        {loading ? (
          <div className="h-full overflow-y-auto scrollbar-hide">
              <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mb-4"></div>
              <div className="text-gray-400 animate-pulse font-medium tracking-wide">Searching the universe...</div>
              </div>
          </div>
        ) : error ? (
          <div className="h-full overflow-y-auto scrollbar-hide">
            <div className="max-w-3xl mx-auto mb-8 mt-6 px-6 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 backdrop-blur-md">
              <div className="font-bold text-lg mb-1">Unable to search</div>
              <div className="text-sm opacity-80">
                {error instanceof Error ? error.message : 'An unknown error occurred'}
              </div>
            </div>
          </div>
        ) : !query ? (
          <div className="h-full overflow-y-auto scrollbar-hide">
            {recentSearches && recentSearches.length > 0 && (
              <div className="max-w-3xl mx-auto mb-8 mt-10">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent Searches</h3>
                  <button 
                    onClick={clearRecentSearches}
                    className="text-xs font-medium text-gray-500 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                  >
                    Clear History
                  </button>
                </div>
                <div className="space-y-3">
                  {recentSearches.map((search) => (
                    <Focusable
                      key={search.id}
                      as="div"
                      className="group flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 hover:shadow-[0_0_20px_rgba(124,58,237,0.1)] transition-all duration-300 cursor-pointer"
                      activeClassName="bg-white/10 border-primary ring-1 ring-primary shadow-[0_0_20px_rgba(124,58,237,0.2)]"
                      onClick={() => handleRecentClick(search.query)}
                    >
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="p-2 rounded-full bg-white/5 group-hover:bg-primary/20 group-hover:text-primary transition-colors text-gray-400">
                          <Clock size={18} />
                        </div>
                        <span className="text-lg text-gray-200 group-hover:text-white font-medium truncate transition-colors">{search.query}</span>
                      </div>
                      <button
                        onClick={(e) => removeRecentSearch(e, search.id!)}
                        className="p-2 rounded-full hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
                      >
                        <X size={18} />
                      </button>
                    </Focusable>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="h-full overflow-y-auto scrollbar-hide">
              <div className="max-w-2xl mx-auto mt-10 p-10 rounded-3xl bg-white/5 border border-white/5 text-center backdrop-blur-sm">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-linear-to-br from-gray-800 to-black border border-white/10 mb-6 shadow-inner">
                  <SearchIcon className="text-gray-500" size={32} />
              </div>
              <div className="text-2xl font-bold text-white mb-2">
                  No results found
              </div>
              <p className="text-gray-400 text-lg mb-6 max-w-md mx-auto">
                  {counts.all > 0 ? (
                  <span>
                      No {filterType === 'movie' ? 'movies' : 'TV shows'} matching "<span className="text-white font-medium">{query}</span>".
                      <br />
                      <button 
                      onClick={() => setFilterType('all')}
                      className="mt-2 text-primary hover:text-primary/80 underline text-base"
                      >
                      View all results ({counts.all})
                      </button>
                  </span>
                  ) : (
                  <span>We couldn't find anything matching "<span className="text-white font-medium">{query}</span>".</span>
                  )}
              </p>
              {counts.all === 0 && (
                  <div className="text-sm text-gray-500 bg-black/20 inline-block px-4 py-2 rounded-full border border-white/5">
                  Try checking for typos or using broader keywords
                  </div>
              )}
              </div>
          </div>
        ) : (
          <VirtualMediaGrid 
              items={filteredResults} 
              renderItem={(item) => (
                  <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                  >
                      <MediaCard 
                          media={item} 
                          onClick={() => saveToHistory(debouncedQuery)} 
                      />
                  </motion.div>
              )}
          />
        )}
      </div>
    </div>
  );
};

export default Search;
