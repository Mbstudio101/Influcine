import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import MediaCard from '../components/MediaCard';

const Watchlist: React.FC = () => {
  const watchlist = useLiveQuery(() => db.watchlist.toArray());

  if (!watchlist) return null;

  return (
    <div className="h-full overflow-y-auto pt-24 px-10 pb-20 scrollbar-hide">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold">My Library</h1>
        <span className="bg-white/10 px-3 py-1 rounded-full text-sm font-medium text-textSecondary">
          {watchlist.length} Items
        </span>
      </div>

      {watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">📂</span>
          </div>
          <p className="text-xl font-medium mb-2">Your library is empty</p>
          <p className="text-sm">Add movies and shows to access them quickly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {watchlist.map((item) => (
            <MediaCard key={item.id} media={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Watchlist;
