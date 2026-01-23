import React, { useEffect, useState } from 'react';
import { getTrending, getImageUrl, getMoviesByCategory, getTVShowsByCategory } from '../services/tmdb';
import { getPersonalizedRecommendations, RecommendationResult } from '../services/recommendations';
import { Media } from '../types';
import { Link } from 'react-router-dom';
import { Play, Plus, Check } from 'lucide-react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import ContentRow from '../components/ContentRow';
import RightSidebar from '../components/RightSidebar';

const Home: React.FC = () => {
  const [featured, setFeatured] = useState<Media | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  
  // Get list of saved IDs to show checkmark
  const savedItems = useLiveQuery(() => db.watchlist.toArray());
  const savedIds = new Set(savedItems?.map(i => i.id));

  const handleSave = async (media: Media) => {
    try {
      if (savedIds.has(media.id)) {
        await db.watchlist.delete(media.id);
      } else {
        await db.watchlist.add({ ...media, savedAt: Date.now() });
      }
    } catch (error) {
      console.error('Failed to save media:', error);
    }
  };

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const data = await getTrending('day');
        if (data.length > 0) {
          // Pick a random item from top 5 for variety
          setFeatured(data[Math.floor(Math.random() * 5)]);
        }
      } catch (error) {
        console.error('Failed to fetch featured:', error);
      }
    };
    fetchFeatured();
    
    const fetchRecs = async () => {
      try {
        const recs = await getPersonalizedRecommendations();
        setRecommendations(recs);
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      }
    };
    fetchRecs();
  }, []);

  const getHistory = async () => {
    const history = await db.history.toArray();
    return history.sort((a, b) => b.savedAt - a.savedAt);
  };

  if (!featured) return <div className="flex items-center justify-center h-full text-white">Loading...</div>;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Dashboard Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 scrollbar-hide">
        
        {/* Brand/Category Quick Links (Optional, inspired by image) */}
        <div className="flex gap-4 px-10 pt-20 pb-4 overflow-x-auto scrollbar-hide">
          {['All', 'Movies', 'TV Shows', 'Anime', 'Documentary'].map((cat, i) => (
            <button 
              key={cat} 
              className={`px-6 py-2 rounded-full text-sm font-bold border transition-all ${i === 0 ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Hero Section - Dashboard Style */}
        <div className="px-10 mb-8">
          <div className="relative w-full h-[60vh] rounded-3xl overflow-hidden shadow-2xl border border-white/5 group">
            <div className="absolute inset-0">
              <img
                src={getImageUrl(featured.backdrop_path, 'original')}
                alt={featured.title || featured.name}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent" />
              <div className="absolute inset-0 bg-linear-to-r from-black/80 via-transparent to-transparent" />
            </div>
            
            <div className="absolute bottom-0 left-0 p-10 w-full max-w-2xl z-10">
              <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 backdrop-blur-md border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider">
                 <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                 #{1} Trending
              </div>
              <h1 className="text-5xl font-black mb-4 drop-shadow-2xl leading-tight text-white tracking-tight">
                {featured.title || featured.name}
              </h1>
              <p className="text-base text-gray-200 mb-8 line-clamp-3 drop-shadow-md leading-relaxed font-medium">
                {featured.overview}
              </p>
              <div className="flex gap-4">
                <Link
                  to={`/watch/${featured.media_type}/${featured.id}`}
                  className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                >
                  <Play fill="currentColor" size={20} />
                  Watch Now
                </Link>
                <button 
                  onClick={() => handleSave(featured)}
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all backdrop-blur-md border border-white/10 hover:scale-105"
                >
                  {savedIds.has(featured.id) ? <Check size={20} /> : <Plus size={20} />}
                  {savedIds.has(featured.id) ? 'Saved' : 'Add List'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Rows */}
        <div className="space-y-2">
          {/* AI Recommendations */}
          {recommendations.map((rec, index) => (
             <ContentRow 
               key={`rec-${index}`} 
               title={rec.type === 'wildcard' ? `✨ ${rec.title}` : rec.title} 
               fetcher={() => Promise.resolve(rec.items)} 
             />
          ))}

          <ContentRow title="Continue Watching" fetcher={getHistory} cardSize="small" />
          <ContentRow title="Trending Now" fetcher={() => getTrending('week')} />
          <ContentRow title="Popular Movies" fetcher={() => getMoviesByCategory('popular')} />
          <ContentRow title="Top Rated Movies" fetcher={() => getMoviesByCategory('top_rated')} />
          <ContentRow title="Popular TV Shows" fetcher={() => getTVShowsByCategory('popular')} />
          <ContentRow title="New Releases" fetcher={() => getMoviesByCategory('now_playing')} />
          <ContentRow title="On The Air" fetcher={() => getTVShowsByCategory('on_the_air')} />
        </div>
      </div>

      {/* Right Sidebar - Dashboard Widgets */}
      <RightSidebar />
    </div>
  );
};

export default Home;
