import React, { useState, useEffect } from 'react';
import { searchMulti, getImageUrl } from '../services/tmdb';
import { Media } from '../types';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Play } from 'lucide-react';
import Focusable from '../components/Focusable';

const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const data = await searchMulti(query);
        setResults(data.filter(item => item.media_type === 'movie' || item.media_type === 'tv'));
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(search, 500);
    return () => clearTimeout(timeoutId);
  }, [query]);

  return (
    <div className="h-full overflow-y-auto pt-24 px-10 pb-10 scrollbar-hide">
      <div className="max-w-3xl mx-auto mb-10">
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
        </div>
      </div>

      {loading ? (
        <div className="text-center text-textSecondary">Searching...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map((item) => (
            <Focusable
              key={item.id}
              onClick={() => navigate(`/watch/${item.media_type}/${item.id}`)}
              className="group relative aspect-2/3 rounded-md overflow-hidden bg-surface transition-transform hover:scale-105 duration-300 cursor-pointer"
              activeClassName="ring-4 ring-primary scale-105 z-10"
            >
              <img
                src={getImageUrl(item.poster_path)}
                alt={item.title || item.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play fill="white" className="text-white w-12 h-12" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-linear-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-sm font-medium truncate">{item.title || item.name}</p>
                <p className="text-xs text-gray-400 capitalize">{item.media_type}</p>
              </div>
            </Focusable>
          ))}
        </div>
      )}
      
      {!loading && query && results.length === 0 && (
        <div className="text-center text-textSecondary">No results found for "{query}"</div>
      )}
    </div>
  );
};

export default Search;
