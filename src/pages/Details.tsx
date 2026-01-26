import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDetails, getCredits, getSimilar, getImageUrl } from '../services/tmdb';
import { MediaDetails } from '../types';
import { Play, Plus, Check, Star, ArrowLeft, X, Youtube } from 'lucide-react';
import { db, SavedMedia } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import ContentRow from '../components/ContentRow';
import Focusable from '../components/Focusable';

const Details: React.FC = () => {
  const { type, id } = useParams<{ type: 'movie' | 'tv'; id: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<MediaDetails | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [credits, setCredits] = useState<any>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  
  const savedItem = useLiveQuery(
    () => (details ? db.watchlist.get(details.id) : undefined),
    [details?.id]
  );
  const isSaved = !!savedItem;

  useEffect(() => {
    if (type && id) {
      const fetchData = async () => {
        try {
          const detailData = await getDetails(type, parseInt(id));
          const creditsData = await getCredits(type, parseInt(id));
          setDetails(detailData);
          setCredits(creditsData);
        } catch (error) {
          console.error('Failed to fetch details:', error);
        }
      };
      fetchData();
      window.scrollTo(0, 0);
    }
  }, [type, id]);

  const handleSave = async () => {
    if (!details) return;
    try {
      const stableId = details.id;
      const existing = await db.watchlist.get(stableId);
      if (existing) {
        await db.watchlist.delete(stableId);
      } else {
        const payload: SavedMedia = {
          ...(details as unknown as SavedMedia),
          savedAt: Date.now(),
          id: stableId
        };
        await db.watchlist.put(payload, stableId);
      }
    } catch (error) {
      console.error('Failed to save media:', error);
    }
  };

  const trailer = details?.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || details?.videos?.results?.find(v => v.site === 'YouTube');

  const handleWatch = async () => {
    if (!details) return;
    try {
      await db.history.put({ ...details, savedAt: Date.now() });
    } catch (error) {
      console.error('Failed to save history:', error);
    }
    navigate(`/watch/${type}/${details.id}`);
  };

  if (!details) return <div className="flex items-center justify-center h-full text-white">Loading...</div>;

  return (
    <div className="h-full overflow-y-auto pb-20 relative scrollbar-hide">
       {/* Back Button */}
       <Focusable
        as="button"
        onClick={() => navigate(-1)} 
        className="absolute top-16 left-6 z-50 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-primary transition-colors"
        activeClassName="ring-2 ring-primary bg-primary"
        autoFocus
      >
        <ArrowLeft size={24} />
      </Focusable>

      {/* Trailer Modal */}
      {showTrailer && trailer && (
        <div className="fixed inset-0 z-100 bg-black/90 flex items-center justify-center p-4">
          <Focusable
            as="button"
            onClick={() => setShowTrailer(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 text-white"
            activeClassName="ring-2 ring-primary bg-white/20"
            autoFocus
          >
            <X size={24} />
          </Focusable>
          <div className="w-full max-w-5xl aspect-video rounded-xl overflow-hidden shadow-2xl">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="relative w-full h-[70vh]">
        <div className="absolute inset-0">
          <img
            src={getImageUrl(details.backdrop_path, 'original')}
            alt={details.title || details.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-linear-to-r from-background via-background/80 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 p-10 w-full max-w-4xl pb-10 z-10 flex gap-8 items-end">
          {/* Poster */}
          <div className="hidden md:block w-48 rounded-lg overflow-hidden shadow-2xl border border-white/10 rotate-3 transform hover:rotate-0 transition-transform duration-500">
            <img 
              src={getImageUrl(details.poster_path)} 
              alt={details.title || details.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1">
            <h1 className="text-5xl font-black mb-2 drop-shadow-2xl leading-tight text-white tracking-tight">
              {details.title || details.name}
            </h1>
            
            <div className="flex items-center gap-4 text-gray-300 mb-6 text-sm font-medium">
               <span className="flex items-center gap-1 text-yellow-400">
                 <Star size={16} fill="currentColor" /> {details.vote_average.toFixed(1)}
               </span>
               <span>{new Date(details.release_date || details.first_air_date || '').getFullYear()}</span>
               {details.runtime && <span>{Math.floor(details.runtime / 60)}h {details.runtime % 60}m</span>}
               {details.number_of_seasons && <span>{details.number_of_seasons} Seasons</span>}
               <div className="flex gap-2">
                 {details.genres?.slice(0, 3).map(g => (
                   <span key={g.id} className="px-2 py-0.5 border border-white/20 rounded-md text-xs">{g.name}</span>
                 ))}
               </div>
            </div>

            <p className="text-lg text-gray-200 mb-8 line-clamp-3 drop-shadow-md leading-relaxed font-medium">
              {details.overview}
            </p>

            <div className="flex gap-4">
              <button
                onClick={handleWatch}
                className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-lg font-bold flex items-center gap-3 transition-all hover:scale-105 shadow-[0_0_30px_rgba(124,58,237,0.4)] text-lg"
              >
                <Play fill="currentColor" size={20} />
                Watch Now
              </button>
              {trailer && (
                <button 
                  onClick={() => setShowTrailer(true)}
                  className="bg-white/10 hover:bg-red-600 hover:border-red-600 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-3 transition-all backdrop-blur-md border border-white/10 hover:scale-105 text-lg"
                >
                  <Youtube size={20} />
                  Trailer
                </button>
              )}
              <button 
                onClick={handleSave}
                className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-3 transition-all backdrop-blur-md border border-white/10 hover:scale-105 text-lg"
              >
                {isSaved ? <Check size={20} /> : <Plus size={20} />}
                {isSaved ? 'In Library' : 'Add to Library'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cast Section */}
      {credits && credits.cast && credits.cast.length > 0 && (
        <div className="px-10 py-8">
          <h2 className="text-xl font-bold mb-4 text-white">Top Cast</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {credits.cast.slice(0, 10).map((actor: any) => (
              <div key={actor.id} className="min-w-[100px] flex flex-col items-center gap-2 text-center">
                <div className="w-20 h-20 rounded-full overflow-hidden border border-white/10">
                  <img 
                    src={getImageUrl(actor.profile_path)} 
                    alt={actor.name}
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{actor.name}</p>
                  <p className="text-xs text-gray-400 leading-tight">{actor.character}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similar Content */}
      <div className="mt-4">
        <ContentRow 
          title="More Like This" 
          fetcher={() => getSimilar(type as 'movie' | 'tv', parseInt(id as string))} 
        />
      </div>
    </div>
  );
};

export default Details;
