import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { getTrending, getImageUrl, getMoviesByCategory, getTVShowsByCategory, discoverMedia, getDetails } from '../services/tmdb';
import { getPersonalizedRecommendations } from '../services/recommendations';
import { Play, Plus, Check } from 'lucide-react';
import { db } from '../db';
import { useWatchlist } from '../hooks/useWatchlist';
import { usePlayer } from '../context/PlayerContext';
import ContentRow from '../components/ContentRow';
import RightSidebar from '../components/RightSidebar';
import Focusable from '../components/Focusable';

const Home: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { play } = usePlayer();
  
  const { data: featured, isLoading: featuredLoading } = useQuery({
    queryKey: ['featured-home'],
    queryFn: async () => {
      const data = await getTrending('day');
      if (data.length > 0) {
        return data[Math.floor(Math.random() * 5)];
      }
      return null;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations-home'],
    queryFn: getPersonalizedRecommendations,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const historyQuery = useLiveQuery(
    () => db.history.orderBy('savedAt').reverse().toArray()
  );
  const defaultHistory = React.useMemo(() => [], []);
  const history = historyQuery ?? defaultHistory;

  const { isSaved: isFeaturedSaved, toggleWatchlist: toggleFeaturedWatchlist } = useWatchlist(featured);

  const content = React.useMemo(() => {
    switch (selectedCategory) {
      case 'Movies':
        return (
          <>
            <ContentRow title="Popular Movies" fetcher={() => getMoviesByCategory('popular')} />
            <ContentRow title="Top Rated Movies" fetcher={() => getMoviesByCategory('top_rated')} />
            <ContentRow title="New Releases" fetcher={() => getMoviesByCategory('now_playing')} />
            <ContentRow title="Upcoming" fetcher={() => getMoviesByCategory('upcoming')} />
            <ContentRow title="Action Movies" fetcher={() => discoverMedia('movie', { with_genres: '28' })} />
            <ContentRow title="Comedy Movies" fetcher={() => discoverMedia('movie', { with_genres: '35' })} />
            <ContentRow title="Sci-Fi Movies" fetcher={() => discoverMedia('movie', { with_genres: '878' })} />
          </>
        );
      case 'TV Shows':
        return (
          <>
            <ContentRow title="Popular TV Shows" fetcher={() => getTVShowsByCategory('popular')} />
            <ContentRow title="Top Rated TV Shows" fetcher={() => getTVShowsByCategory('top_rated')} />
            <ContentRow title="On The Air" fetcher={() => getTVShowsByCategory('on_the_air')} />
            <ContentRow title="Action & Adventure" fetcher={() => discoverMedia('tv', { with_genres: '10759' })} />
            <ContentRow title="Comedy Series" fetcher={() => discoverMedia('tv', { with_genres: '35' })} />
            <ContentRow title="Drama Series" fetcher={() => discoverMedia('tv', { with_genres: '18' })} />
          </>
        );
      case 'Anime':
        return (
          <>
            <ContentRow title="Popular Anime" fetcher={() => discoverMedia('tv', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' })} />
            <ContentRow title="Top Rated Anime" fetcher={() => discoverMedia('tv', { with_genres: '16', with_original_language: 'ja', sort_by: 'vote_average.desc', 'vote_count.gte': 100 })} />
            <ContentRow title="Anime Movies" fetcher={() => discoverMedia('movie', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' })} />
            <ContentRow title="New Anime Releases" fetcher={() => discoverMedia('tv', { with_genres: '16', with_original_language: 'ja', 'first_air_date.gte': new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], sort_by: 'popularity.desc' })} />
          </>
        );
      case 'Documentary':
        return (
          <>
            <ContentRow title="Popular Documentaries" fetcher={() => discoverMedia('movie', { with_genres: '99', sort_by: 'popularity.desc' })} />
            <ContentRow title="Docuseries" fetcher={() => discoverMedia('tv', { with_genres: '99', sort_by: 'popularity.desc' })} />
            <ContentRow title="Nature & Science" fetcher={() => discoverMedia('movie', { with_genres: '99', sort_by: 'vote_average.desc', 'vote_count.gte': 50 })} />
            <ContentRow title="History" fetcher={() => discoverMedia('movie', { with_genres: '99,36', sort_by: 'popularity.desc' })} />
          </>
        );
      default: // 'All'
        return (
          <>
            {/* AI Recommendations */}
            {recommendations.map((rec, index) => (
               <ContentRow 
                 key={`rec-${index}`} 
                 title={rec.type === 'wildcard' ? `✨ ${rec.title}` : rec.title} 
                 data={rec.items}
               />
            ))}

            <ContentRow title="Continue Watching" data={history} cardSize="small" />
            <ContentRow title="Trending Now" fetcher={() => getTrending('week')} />
            <ContentRow title="Popular Movies" fetcher={() => getMoviesByCategory('popular')} />
            <ContentRow title="Top Rated Movies" fetcher={() => getMoviesByCategory('top_rated')} />
            <ContentRow title="Popular TV Shows" fetcher={() => getTVShowsByCategory('popular')} />
            <ContentRow title="New Releases" fetcher={() => getMoviesByCategory('now_playing')} />
            <ContentRow title="On The Air" fetcher={() => getTVShowsByCategory('on_the_air')} />
          </>
        );
    }
  }, [selectedCategory, recommendations, history]);

  if (featuredLoading) return <div className="flex items-center justify-center h-full text-white">Loading...</div>;
  if (!featured) return <div className="flex items-center justify-center h-full text-white">No content available</div>;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Dashboard Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 scrollbar-hide">
        
        {/* Brand/Category Quick Links */}
        <div className="flex gap-4 px-10 pt-20 pb-4 overflow-x-auto scrollbar-hide">
          {['All', 'Movies', 'TV Shows', 'Anime', 'Documentary'].map((cat) => (
            <Focusable 
              key={cat} 
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-2 rounded-full text-sm font-bold border transition-all cursor-pointer ${selectedCategory === cat ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white'}`}
              activeClassName="ring-2 ring-primary scale-105 bg-white text-black"
            >
              {cat}
            </Focusable>
          ))}
        </div>

        {/* Hero Section - Dashboard Style */}
        <div className="px-10 mb-8">
          <div className="relative w-full h-[60vh] rounded-3xl overflow-hidden shadow-2xl border border-white/5 group">
            <div className="absolute inset-0">
              <img
                src={getImageUrl(featured.backdrop_path, 'w1280')}
                srcSet={`
                  ${getImageUrl(featured.backdrop_path, 'w780')} 780w,
                  ${getImageUrl(featured.backdrop_path, 'w1280')} 1280w,
                  ${getImageUrl(featured.backdrop_path, 'original')} 1920w
                `}
                sizes="(max-width: 1024px) 100vw, 80vw"
                alt={featured.title || featured.name}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                loading="eager"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent" />
              <div className="absolute inset-0 bg-linear-to-r from-black/80 via-transparent to-transparent" />
            </div>
            
            <div className="absolute bottom-0 left-0 p-10 w-full max-w-2xl z-10">
              <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 backdrop-blur-md border border-primary/20 text-xs font-bold text-primary uppercase tracking-wider">
                 <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                 Trending Now
              </div>
              <h1 className="text-5xl font-black mb-4 drop-shadow-2xl leading-tight text-white tracking-tight line-clamp-2">
                {featured.title || featured.name}
              </h1>
              <div className="max-h-[15vh] overflow-y-auto scrollbar-hide mb-8">
                <p className="text-base text-gray-200 drop-shadow-md leading-relaxed font-medium">
                  {featured.overview}
                </p>
              </div>
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
                <Focusable
                  onClick={async () => {
                    if (featured) {
                      // Fetch full details to ensure we have seasons/episodes if it's a TV show
                      // or just pass what we have if we want speed.
                      // Best to fetch details.
                      try {
                        const details = await getDetails(featured.media_type, featured.id);
                        play(details);
                      } catch (e) {
                        console.error('Failed to play featured item', e);
                      }
                    }
                  }}
                  className="bg-linear-to-r from-primary to-purple-600 hover:from-primary-hover hover:to-purple-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(124,58,237,0.5)] hover:shadow-[0_0_30px_rgba(124,58,237,0.7)] cursor-pointer shrink-0 border border-white/10 uppercase tracking-wide group"
                  activeClassName="ring-4 ring-white scale-110 z-20"
                >
                  <Play fill="currentColor" size={20} className="group-hover:animate-pulse" />
                  Watch Now
                </Focusable>
                <Focusable 
                  onClick={toggleFeaturedWatchlist}
                  className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 backdrop-blur-md border hover:scale-105 cursor-pointer shrink-0 ${
                    isFeaturedSaved
                      ? 'bg-primary border-primary text-white shadow-[0_0_20px_rgba(124,58,237,0.4)]'
                      : 'bg-white/5 hover:bg-white/10 text-white border-white/10 hover:border-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                  }`}
                  activeClassName="ring-4 ring-white scale-110 z-20"
                >
                  {isFeaturedSaved ? <Check size={20} /> : <Plus size={20} />}
                  {isFeaturedSaved ? 'Saved' : 'Add List'}
                </Focusable>
              </div>
            </div>
          </div>
        </div>

        {/* Content Rows */}
        <div className="space-y-2">
          {content}
        </div>
      </div>

      {/* Right Sidebar - Dashboard Widgets */}
      <RightSidebar />
    </div>
  );
};

export default Home;
