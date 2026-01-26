import React, { useState, useEffect } from 'react';
import { VideoAgent } from '../services/VideoAgent';
import { Media } from '../types';
import { Search as SearchIcon, Zap } from 'lucide-react';
import Focusable from '../components/Focusable';
import MediaCard from '../components/MediaCard';
import { useToast } from '../context/toast';

const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  
  useEffect(() => {
    let cancelled = false;

    const search = async () => {
      if (!query.trim()) {
        setResults([]);
        setIsCached(false);
        setError(null);
        return;
      }
      setLoading(true);
      try {
        const agentResult = await VideoAgent.search(query);
        if (!cancelled) {
          setResults(agentResult.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv'));
          setIsCached(agentResult.source === 'cache');
          setError(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Search failed:', error);
          const message = 'Search failed. Please check your connection and try again.';
          setError(message);
          showToast(message, 'error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(search, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [query, showToast]);

  return (
    <div className="h-full overflow-y-auto pt-24 px-10 pb-10 scrollbar-hide">
      <div className="max-w-3xl mx-auto mb-6">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary" size={24} />
          <Focusable
            as="input"
            type="text"
            placeholder="Search for movies and TV shows..."
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            className="w-full bg-surface text-white pl-14 pr-6 py-4 rounded-full text-lg focus:outline-none focus:ring-2 focus:ring-primary placeholder-textSecondary"
            autoFocus
            activeClassName="ring-2 ring-primary"
          />
          {isCached && !loading && (
             <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 flex items-center gap-1 text-xs font-medium" title="Served from intelligent cache">
                <Zap size={14} fill="currentColor" />
                <span>Cached</span>
             </div>
          )}
        </div>
      </div>

      {error && (
        <div className="max-w-3xl mx-auto mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/40 text-sm text-red-200">
          <div className="font-semibold">Search problem</div>
          <div className="mt-1">
            {error}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-textSecondary">Searching...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map((item) => (
            <MediaCard key={item.id} media={item} />
          ))}
        </div>
      )}

      {!loading && query && !error && results.length === 0 && (
        <div className="max-w-3xl mx-auto mt-10 px-6 py-6 rounded-2xl bg-white/5 border border-white/10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-3">
            <SearchIcon className="text-textSecondary" size={20} />
          </div>
          <div className="text-base font-semibold text-white mb-1">
            No results for “{query}”
          </div>
          <p className="text-sm text-textSecondary mb-2">
            Try a different title, simplify your keywords, or double-check your spelling.
          </p>
          <p className="text-xs text-textSecondary">
            You can also search by actor, director, or franchise name.
          </p>
        </div>
      )}
    </div>
  );
};

export default Search;
