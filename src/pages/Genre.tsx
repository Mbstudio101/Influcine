import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { discoverMedia } from '../services/tmdb';
import MediaCard from '../components/MediaCard';
import { Sparkles } from 'lucide-react';

const GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics'
};

const Genre: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const genreName = id ? GENRES[parseInt(id)] || 'Unknown Genre' : 'Genre';

  const { data, isLoading: loading } = useQuery({
    queryKey: ['genre', id],
    queryFn: async () => {
      if (!id) return { movies: [], shows: [] };
      const [movieData, tvData] = await Promise.all([
        discoverMedia('movie', { with_genres: id, sort_by: 'popularity.desc' }),
        discoverMedia('tv', { with_genres: id, sort_by: 'popularity.desc' })
      ]);
      return { movies: movieData, shows: tvData };
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const movies = data?.movies || [];
  const shows = data?.shows || [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20">
        <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mb-4" />
        <div className="text-gray-400 animate-pulse">Exploring {genreName}...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pt-24 px-10 pb-10 scrollbar-hide">
      <div className="mb-8 flex items-center gap-3">
        <div className="p-3 bg-primary/20 rounded-full text-primary">
          <Sparkles size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">{genreName}</h1>
          <p className="text-gray-400">Top rated and trending in {genreName}</p>
        </div>
      </div>

      {/* Movies Section */}
      {movies.length > 0 && (
        <div className="mb-12">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-primary rounded-full"/>
            Popular Movies
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {movies.map(media => (
              <MediaCard key={media.id} media={media} />
            ))}
          </div>
        </div>
      )}

      {/* TV Shows Section */}
      {shows.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-purple-500 rounded-full"/>
            Popular TV Shows
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {shows.map(media => (
              <MediaCard key={media.id} media={media} />
            ))}
          </div>
        </div>
      )}
      
      {movies.length === 0 && shows.length === 0 && (
        <div className="text-center text-gray-400 py-20">
          No content found for this genre.
        </div>
      )}
    </div>
  );
};

export default Genre;
