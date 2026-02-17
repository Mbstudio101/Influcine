import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNewOnTopPlatforms } from '../services/tmdb';
import MediaCard from '../components/MediaCard';
import { Sparkles } from 'lucide-react';

const JustReleased: React.FC = () => {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['just-released-full-list'],
    queryFn: () => getNewOnTopPlatforms(60, 'US'),
    staleTime: 1000 * 60 * 60 * 2,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20">
        <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mb-4" />
        <div className="text-gray-400 animate-pulse">Loading just-released titles...</div>
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
          <h1 className="text-3xl font-bold text-white">Just Released</h1>
          <p className="text-gray-400">Netflix + major streaming platforms</p>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {items.map((media) => (
            <MediaCard key={`${media.media_type || 'movie'}-${media.id}`} media={media} />
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-400 py-20">
          No just-released titles found right now.
        </div>
      )}
    </div>
  );
};

export default JustReleased;
