import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getTrending,
  getImageUrl,
  getMoviesByCategory,
  getTVShowsByCategory,
  discoverMedia,
  getDetails,
  getVideos,
} from '../services/tmdb';
import { getPersonalizedRecommendations } from '../services/recommendations';
import { findBestTrailer } from '../utils/videoUtils';
import { Play, Plus, Check, Youtube, Info } from 'lucide-react';
import { db } from '../db';
import { useWatchlist } from '../hooks/useWatchlist';
import ContentRow from '../components/ContentRow';
import { Media } from '../types';
import { usePlayer } from '../context/PlayerContext';
import Focusable from '../components/Focusable';
import TrailerModal from '../components/TrailerModal';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';

const ROW_PRESET = {
  cardSize: 'large' as const,
  cardVariant: 'backdrop' as const,
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { play } = usePlayer();

  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);

  const { data: featured, isLoading: featuredLoading } = useQuery({
    queryKey: ['featured'],
    queryFn: async () => {
      const trending = await getTrending('day');
      return trending[0];
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: featuredDetails } = useQuery({
    queryKey: ['featured-details', featured?.id, featured?.media_type],
    queryFn: async () => {
      if (!featured) return null;
      const type = featured.media_type || (featured.title ? 'movie' : 'tv');
      return getDetails(type as 'movie' | 'tv', featured.id);
    },
    enabled: !!featured,
    staleTime: 1000 * 60 * 30,
  });

  const { data: recommendations = [] } = useQuery({
    queryKey: ['recommendations-home', profile?.id],
    queryFn: () => getPersonalizedRecommendations(profile?.id),
    staleTime: 1000 * 60 * 60,
    enabled: !!profile,
  });

  const historyQuery = useLiveQuery(() => db.history.orderBy('savedAt').reverse().limit(10).toArray());
  const history = React.useMemo<Media[]>(() => historyQuery ?? [], [historyQuery]);

  const { isSaved: isFeaturedSaved, toggleWatchlist: toggleFeaturedWatchlist } = useWatchlist(
    (featured || { id: 0, media_type: 'movie' }) as unknown as Media
  );
  const featuredYear = featured ? (new Date(featured.release_date || featured.first_air_date || '').getFullYear() || 'N/A') : 'N/A';
  const featuredScore = featured && typeof featured.vote_average === 'number' ? featured.vote_average.toFixed(1) : 'N/A';
  const featuredType = featured ? (featured.media_type || (featured.title ? 'movie' : 'tv')).toUpperCase() : 'N/A';
  const featuredMatch = featured && typeof featured.vote_average === 'number' ? `${Math.round(featured.vote_average * 10)}% Match` : 'Top Pick';
  const featuredLength =
    featuredDetails?.runtime
      ? `${Math.floor(featuredDetails.runtime / 60)}h ${featuredDetails.runtime % 60}m`
      : featuredDetails?.number_of_seasons
      ? `${featuredDetails.number_of_seasons} Seasons`
      : null;
  const featuredGenres = featuredDetails?.genres?.slice(0, 3) || [];

  const handlePlayTrailer = async () => {
    if (!featured) return;
    try {
      const type = featured.media_type || (featured.title ? 'movie' : 'tv');
      const videos = await getVideos(type as 'movie' | 'tv', featured.id);
      const trailer = findBestTrailer(videos);

      if (trailer) {
        setTrailerKey(trailer.key);
        setShowTrailer(true);
      } else {
        console.warn('No trailer found');
      }
    } catch (e) {
      console.error('Failed to fetch trailer', e);
    }
  };

  const moviesContent = React.useMemo(
    () => (
      <>
        <ContentRow title="Popular Movies" fetcher={() => getMoviesByCategory('popular')} {...ROW_PRESET} />
        <ContentRow title="Top Rated Movies" fetcher={() => getMoviesByCategory('top_rated')} {...ROW_PRESET} />
        <ContentRow title="New Releases" fetcher={() => getMoviesByCategory('now_playing')} {...ROW_PRESET} />
        <ContentRow title="Upcoming" fetcher={() => getMoviesByCategory('upcoming')} {...ROW_PRESET} />
        <ContentRow title="Action Movies" fetcher={() => discoverMedia('movie', { with_genres: '28' })} {...ROW_PRESET} />
        <ContentRow title="Comedy Movies" fetcher={() => discoverMedia('movie', { with_genres: '35' })} {...ROW_PRESET} />
        <ContentRow title="Sci-Fi Movies" fetcher={() => discoverMedia('movie', { with_genres: '878' })} {...ROW_PRESET} />
      </>
    ),
    []
  );

  const tvShowsContent = React.useMemo(
    () => (
      <>
        <ContentRow title="Popular TV Shows" fetcher={() => getTVShowsByCategory('popular')} {...ROW_PRESET} />
        <ContentRow title="Top Rated TV Shows" fetcher={() => getTVShowsByCategory('top_rated')} {...ROW_PRESET} />
        <ContentRow title="On The Air" fetcher={() => getTVShowsByCategory('on_the_air')} {...ROW_PRESET} />
        <ContentRow title="Action & Adventure" fetcher={() => discoverMedia('tv', { with_genres: '10759' })} {...ROW_PRESET} />
        <ContentRow title="Comedy Series" fetcher={() => discoverMedia('tv', { with_genres: '35' })} {...ROW_PRESET} />
        <ContentRow title="Drama Series" fetcher={() => discoverMedia('tv', { with_genres: '18' })} {...ROW_PRESET} />
      </>
    ),
    []
  );

  const animeContent = React.useMemo(
    () => (
      <>
        <ContentRow
          title="Popular Anime"
          fetcher={() => discoverMedia('tv', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' })}
          {...ROW_PRESET}
        />
        <ContentRow
          title="Top Rated Anime"
          fetcher={() =>
            discoverMedia('tv', {
              with_genres: '16',
              with_original_language: 'ja',
              sort_by: 'vote_average.desc',
              'vote_count.gte': 100,
            })
          }
          {...ROW_PRESET}
        />
        <ContentRow
          title="Anime Movies"
          fetcher={() => discoverMedia('movie', { with_genres: '16', with_original_language: 'ja', sort_by: 'popularity.desc' })}
          {...ROW_PRESET}
        />
        <ContentRow
          title="New Anime Releases"
          fetcher={() =>
            discoverMedia('tv', {
              with_genres: '16',
              with_original_language: 'ja',
              'first_air_date.gte': new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              sort_by: 'popularity.desc',
            })
          }
          {...ROW_PRESET}
        />
      </>
    ),
    []
  );

  const documentaryContent = React.useMemo(
    () => (
      <>
        <ContentRow title="Popular Documentaries" fetcher={() => discoverMedia('movie', { with_genres: '99', sort_by: 'popularity.desc' })} {...ROW_PRESET} />
        <ContentRow title="Docuseries" fetcher={() => discoverMedia('tv', { with_genres: '99', sort_by: 'popularity.desc' })} {...ROW_PRESET} />
        <ContentRow title="Nature & Science" fetcher={() => discoverMedia('movie', { with_genres: '99', sort_by: 'vote_average.desc', 'vote_count.gte': 50 })} {...ROW_PRESET} />
      </>
    ),
    []
  );

  const content = React.useMemo(() => {
    switch (selectedCategory) {
      case 'Movies':
        return moviesContent;
      case 'TV Shows':
        return tvShowsContent;
      case 'Anime':
        return animeContent;
      case 'Documentary':
        return documentaryContent;
      default:
        return (
          <>
            {history.length > 0 && <ContentRow title="Continue Watching" data={history} {...ROW_PRESET} />}

            {recommendations.length > 0 &&
              recommendations.map((rec, index) => (
                <ContentRow key={`${rec.type}-${index}`} title={rec.title} data={rec.items} {...ROW_PRESET} />
              ))}

            <ContentRow title="Trending Now" fetcher={() => getTrending('day')} {...ROW_PRESET} />
            <ContentRow title="Popular Movies" fetcher={() => getMoviesByCategory('popular')} {...ROW_PRESET} />
            <ContentRow title="Popular TV Shows" fetcher={() => getTVShowsByCategory('popular')} {...ROW_PRESET} />
            <ContentRow title="Top Rated" fetcher={() => getTrending('week')} {...ROW_PRESET} />
            <ContentRow title="Action Movies" fetcher={() => discoverMedia('movie', { with_genres: '28' })} {...ROW_PRESET} />
          </>
        );
    }
  }, [selectedCategory, history, recommendations, moviesContent, tvShowsContent, animeContent, documentaryContent]);

  if (featuredLoading) return <div className="flex items-center justify-center h-full text-white">Loading...</div>;
  if (!featured) return <div className="flex items-center justify-center h-full text-white">No content available</div>;

  return (
    <div className="flex h-full overflow-hidden bg-transparent">
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-10 scrollbar-hide">
        <div className="px-4 md:px-8 lg:px-10 pt-12 md:pt-14">
          <div className="relative w-full h-[56vh] min-h-[380px] max-h-[620px] overflow-visible bg-transparent">
            <div className="absolute inset-0">
              <img
                src={getImageUrl(featured.backdrop_path, 'original')}
                srcSet={`
                  ${getImageUrl(featured.backdrop_path, 'w780')} 780w,
                  ${getImageUrl(featured.backdrop_path, 'w1280')} 1280w,
                  ${getImageUrl(featured.backdrop_path, 'original')} 1920w
                `}
                sizes="(max-width: 1024px) 100vw, 80vw"
                alt={featured.title || featured.name}
                className="w-full h-full object-cover object-top"
                loading="eager"
              />
              <div className="absolute inset-0 bg-linear-to-t from-[#02050d] via-[#02050d]/45 to-transparent" />
              <div className="absolute inset-0 bg-linear-to-r from-[#02050d]/92 via-[#02050d]/25 to-transparent" />
            </div>

            <div className="absolute bottom-0 left-0 p-5 md:p-8 lg:p-10 w-full max-w-3xl z-10">
              <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-slate-200">
                <span className="px-3 py-1 rounded-full bg-[rgba(255,79,163,0.2)] border border-[rgba(255,122,182,0.45)] text-xs tracking-[0.16em] uppercase text-[#ffd1e8]">Featured</span>
                <span className="hidden sm:inline text-white/70">English | Hindi | Tamil | Telugu | Malayalam | Kannada</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black mb-3 text-white tracking-[0.22em] uppercase leading-none">
                {featured.title || featured.name}
              </h1>

              <p className="text-sm md:text-base text-slate-200/95 leading-relaxed max-w-2xl mb-4 line-clamp-3">
                {featured.overview}
              </p>

              <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/35 text-[#d9ffe4] font-semibold">{featuredMatch}</span>
                <span className="px-2.5 py-1 rounded-full bg-white/12 border border-white/15 text-white/90">{featuredYear}</span>
                <span className="px-2.5 py-1 rounded-full bg-white/12 border border-white/15 text-white/90">IMDb {featuredScore}</span>
                <span className="px-2.5 py-1 rounded-full bg-white/12 border border-white/15 text-white/90">{featuredType}</span>
                {featuredLength && (
                  <span className="px-2.5 py-1 rounded-full bg-white/12 border border-white/15 text-white/90">{featuredLength}</span>
                )}
                {featuredGenres.map((genre) => (
                  <span key={genre.id} className="px-2.5 py-1 rounded-full bg-white/8 border border-white/10 text-white/80">{genre.name}</span>
                ))}
                <span className="text-white/60">Contains mature themes and violence.</span>
              </div>

              <div className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-1">
                <Focusable
                  onClick={async () => {
                    if (featured) {
                      try {
                        const type = featured.media_type || (featured.title ? 'movie' : 'tv');
                        const details = await getDetails(type as 'movie' | 'tv', featured.id);
                        play(details);
                      } catch (e) {
                        console.error('Failed to play featured item', e);
                      }
                    }
                  }}
                  className="bg-linear-to-r from-[#ff4fa3] via-[#ff7ab6] to-[#7d7bff] text-white px-6 md:px-7 py-3 rounded-full font-semibold flex items-center gap-2 transition-all duration-300 hover:brightness-110 cursor-pointer shrink-0 shadow-[0_10px_24px_rgba(255,79,163,0.35)]"
                  activeClassName="ring-4 ring-primary scale-105 z-20"
                >
                  <Play fill="currentColor" size={18} />
                  Play S1 E1
                </Focusable>

                <Focusable
                  onClick={toggleFeaturedWatchlist}
                  className={`px-5 py-3 rounded-full font-semibold flex items-center gap-2 transition-all duration-300 backdrop-blur-md border cursor-pointer shrink-0 ${
                    isFeaturedSaved
                      ? 'bg-[#5eead4]/30 border-[#5eead4] text-white shadow-[0_0_20px_rgba(94,234,212,0.4)]'
                      : 'bg-[rgba(125,123,255,0.16)] hover:bg-[rgba(125,123,255,0.28)] text-white border-[rgba(125,123,255,0.45)]'
                  }`}
                  activeClassName="ring-4 ring-white scale-110 z-20"
                  title={isFeaturedSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
                >
                  {isFeaturedSaved ? <Check size={18} /> : <Plus size={18} />}
                  {isFeaturedSaved ? 'Saved' : 'Add List'}
                </Focusable>

                <Focusable
                  onClick={handlePlayTrailer}
                  className="px-5 py-3 rounded-full font-semibold flex items-center gap-2 bg-[rgba(255,179,71,0.14)] hover:bg-[rgba(255,179,71,0.28)] text-white border border-[rgba(255,179,71,0.5)] transition-all duration-300 cursor-pointer shrink-0"
                  title="Play trailer"
                >
                  <Youtube size={18} className="text-[#ff9ca9]" />
                  Trailer
                </Focusable>

                <Focusable
                  onClick={() => {
                    const type = featured.media_type || (featured.title ? 'movie' : 'tv');
                    navigate(`/details/${type}/${featured.id}`, { state: featured });
                  }}
                  className="px-5 py-3 rounded-full font-semibold flex items-center gap-2 bg-[rgba(94,234,212,0.14)] hover:bg-[rgba(94,234,212,0.26)] text-white border border-[rgba(94,234,212,0.5)] transition-all duration-300 cursor-pointer shrink-0"
                  title="More info"
                >
                  <Info size={18} />
                  Details
                </Focusable>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 md:mt-7 space-y-1 pb-12">
          {['All', 'Movies', 'TV Shows', 'Anime', 'Documentary'].map(cat => (
            <Focusable
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`ml-4 md:ml-8 lg:ml-10 mr-2 inline-flex px-4 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer tracking-wide ${
                selectedCategory === cat
                  ? 'bg-white text-[#111827] border-white'
                  : 'bg-transparent text-slate-300 border-white/15 hover:border-white/35 hover:text-white'
              }`}
              activeClassName="ring-2 ring-primary scale-105"
            >
              {cat}
            </Focusable>
          ))}

          <div className="pt-5">{content}</div>
        </div>
      </div>

      {showTrailer && trailerKey && (
        <TrailerModal
          videoKey={trailerKey}
          title={featured?.title || featured?.name}
          onClose={() => setShowTrailer(false)}
        />
      )}
    </div>
  );
};

export default Home;
