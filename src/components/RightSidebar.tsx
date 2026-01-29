import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrending, getImageUrl } from '../services/tmdb';
import { Link, useNavigate } from 'react-router-dom';
import { Star, ChevronRight, Hash, Crown } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { Avatar } from './Avatars';
import Focusable from './Focusable';

const GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
];

const RightSidebar: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: trending = [] } = useQuery({
    queryKey: ['trending', 'day'],
    queryFn: () => getTrending('day'),
    staleTime: 1000 * 60 * 30, // 30 mins
    select: (data) => data.slice(0, 5),
  });

  return (
    <div className="w-80 h-full border-l border-white/5 bg-black/20 backdrop-blur-md pt-20 px-6 pb-6 overflow-y-auto hidden xl:block">
      {/* User Profile Summary */}
      <div className="flex items-center gap-3 mb-8 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer">
        <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary to-purple-800 flex items-center justify-center font-bold text-white shadow-lg overflow-hidden p-1">
          <Avatar id={profile?.avatarId || 'human-m-1'} />
        </div>
        <div>
          <div className="flex items-center gap-1">
            <p className="text-sm font-bold text-white">{profile?.name || 'Guest'}</p>
            {!profile?.isKid && <Crown size={14} className="text-yellow-400 fill-yellow-400" />}
          </div>
          <p className="text-xs text-gray-400">{profile?.isKid ? 'Kids Profile' : 'Premium Member'}</p>
        </div>
      </div>

      {/* Favorite Genres */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Favorite Genres</h3>
          <button className="text-primary text-xs hover:text-white transition-colors">Edit</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {GENRES.slice(0, 8).map(genre => (
            <Focusable 
              key={genre.id} 
              onClick={() => navigate(`/genre/${genre.id}`)}
              className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs text-gray-300 hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 cursor-pointer"
              activeClassName="ring-2 ring-primary bg-primary text-white scale-105 z-10"
            >
              {genre.name}
            </Focusable>
          ))}
          <Focusable className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs text-gray-300 hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer">
             <Hash size={10} /> More
          </Focusable>
        </div>
      </div>

      {/* Top Picks / Mini List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Top Picks for You</h3>
          <Link to="/search" className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
            See all <ChevronRight size={12} />
          </Link>
        </div>
        
        <div className="space-y-4">
          {trending.map((item, index) => (
            <Focusable 
              key={item.id} 
              onClick={() => navigate(`/details/${item.media_type}/${item.id}`)}
              className="flex gap-3 group cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-colors"
              activeClassName="ring-2 ring-primary bg-white/10"
            >
              <div className="relative w-16 h-24 shrink-0 rounded-lg overflow-hidden">
                <img 
                  src={getImageUrl(item.poster_path)} 
                  alt={item.title || item.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                />
                <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-md px-1.5 rounded text-[10px] font-bold text-white border border-white/10">
                  #{index + 1}
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <h4 className="text-sm font-bold text-gray-200 group-hover:text-primary transition-colors line-clamp-2 leading-tight mb-1">
                  {item.title || item.name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1 text-yellow-500">
                    <Star size={10} fill="currentColor" /> {item.vote_average.toFixed(1)}
                  </span>
                  <span>•</span>
                  <span>{item.media_type === 'movie' ? 'Movie' : 'TV'}</span>
                </div>
                <div className="mt-2 text-[10px] text-gray-500 line-clamp-1">
                  {item.overview}
                </div>
              </div>
            </Focusable>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;
