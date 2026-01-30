import { useState, useRef } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, isSameMonth, isSameDay, isToday, 
  startOfWeek, endOfWeek 
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, 
  Film, Tv, Bell, CheckCircle, Star, Info, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Media } from '../types';
import { discoverMedia, getDetails, getImageUrl } from '../services/tmdb';
import { db, Reminder } from '../db';
import Focusable from '../components/Focusable';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

type ViewMode = 'month' | 'list';
type FilterType = 'all' | 'movie' | 'tv';

interface CalendarEvent extends Media {
  releaseDate: Date;
  isReminderSet?: boolean;
  isEpisode?: boolean;
  episodeInfo?: string;
  popularity: number;
}

// Genius Hover Card Component
const GeniusHoverCard = ({ event, position, onClose, onToggleReminder, isReminderSet }: { 
  event: CalendarEvent; 
  position: { x: number; y: number }; 
  onClose: () => void;
  onToggleReminder: (e: React.MouseEvent) => void;
  isReminderSet: boolean;
}) => {
  const navigate = useNavigate();
  
  // Adjust position to keep on screen
  const safeX = Math.min(Math.max(position.x, 20), window.innerWidth - 340); // 320px width + padding
  const safeY = Math.min(Math.max(position.y, 20), window.innerHeight - 450); // Estimate height

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      style={{ left: safeX, top: safeY }}
      className="fixed z-50 w-80 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-left"
      onMouseLeave={onClose}
    >
      {/* Backdrop Image Header */}
      <div className="relative h-40 w-full">
        <img 
          src={getImageUrl(event.backdrop_path || event.poster_path)} 
          alt={event.title}
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#1a1a1a] via-transparent to-transparent" />
        <div className="absolute top-2 right-2">
          <button 
            onClick={onClose}
            className="p-1 bg-black/40 rounded-full hover:bg-black/60 text-white/70 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="p-5 -mt-6 relative">
        {/* Poster & Title */}
        <div className="flex gap-4 mb-4">
          <div className="w-20 h-28 shrink-0 rounded-lg shadow-lg overflow-hidden border border-white/10 bg-black/50">
            <img 
              src={getImageUrl(event.poster_path)} 
              alt="Poster" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0 pt-6">
            <h3 className="text-lg font-bold leading-tight text-white mb-1 line-clamp-2">
              {event.title || event.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-400">
               <span className={`px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${event.media_type === 'movie' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                 {event.media_type === 'movie' ? 'Movie' : 'TV'}
               </span>
               {event.vote_average > 0 && (
                 <span className="flex items-center gap-1 text-yellow-500">
                   <Star size={10} fill="currentColor" />
                   {event.vote_average.toFixed(1)}
                 </span>
               )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
             <span className="text-gray-400">Release Date</span>
             <span className="font-medium text-white">{format(event.releaseDate, 'MMMM d, yyyy')}</span>
          </div>
          
          {event.isEpisode && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-2 text-xs">
              <p className="text-purple-300 font-medium mb-0.5">New Episode</p>
              <p className="text-gray-300">{event.episodeInfo}</p>
            </div>
          )}

          <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">
            {event.overview || "No overview available."}
          </p>

          <div className="flex gap-2 pt-2">
            <button 
              onClick={() => navigate(`/details/${event.media_type}/${event.id}`)}
              className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Info size={16} /> Details
            </button>
            <button 
              onClick={onToggleReminder}
              className={`
                flex-1 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2
                ${isReminderSet ? 'bg-primary text-white hover:bg-primary/90' : 'bg-white/10 hover:bg-white/20 text-white'}
              `}
            >
              {isReminderSet ? <CheckCircle size={16} /> : <Bell size={16} />}
              {isReminderSet ? 'Set' : 'Remind'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>,
    document.body
  );
};

const CalendarPage = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [filter, setFilter] = useState<FilterType>('all');
  
  // Hover State
  const [hoveredEvent, setHoveredEvent] = useState<{ event: CalendarEvent; position: { x: number; y: number } } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reminders = useLiveQuery(() => db.reminders.toArray(), []) || [];

  const { data: events = [], isLoading: loading } = useQuery({
    queryKey: ['calendar-events', format(startOfMonth(currentDate), 'yyyy-MM'), filter],
    queryFn: async () => {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      
      const gte = format(subMonths(start, 0), 'yyyy-MM-dd');
      const lte = format(addMonths(end, 0), 'yyyy-MM-dd');

      let fetchedEvents: CalendarEvent[] = [];

      // 1. Fetch Watchlist Next Episodes (Priority)
      if (filter === 'all' || filter === 'tv') {
        const watchlist = await db.library.filter(item => item.media_type === 'tv').toArray();
        const watchlistPromises = watchlist.map(async (show) => {
          try {
            const details = await getDetails('tv', show.id, {});
            if (details.next_episode_to_air) {
               const airDate = new Date(details.next_episode_to_air.air_date);
               if (airDate >= start && airDate <= end) {
                 return {
                   ...show,
                   releaseDate: airDate,
                   title: show.name || show.title || 'Unknown',
                   overview: details.next_episode_to_air.overview || show.overview,
                   backdrop_path: details.next_episode_to_air.still_path || show.backdrop_path,
                   isEpisode: true,
                   episodeInfo: `S${details.next_episode_to_air.season_number}E${details.next_episode_to_air.episode_number}: ${details.next_episode_to_air.name}`
                 } as CalendarEvent;
               }
            }
          } catch (e) {
            console.warn(`Failed to fetch details for ${show.name}`, e);
          }
          return null;
        });
        
        const watchlistEvents = (await Promise.all(watchlistPromises)).filter((e): e is CalendarEvent => e !== null);
        fetchedEvents = [...fetchedEvents, ...watchlistEvents];
      }

      // 2. Fetch Global Discover
      if (filter === 'all' || filter === 'movie') {
        const movies = await discoverMedia('movie', {
          'primary_release_date.gte': gte,
          'primary_release_date.lte': lte,
          sort_by: 'popularity.desc'
        });
        fetchedEvents = [...fetchedEvents, ...movies.map(m => ({ ...m, releaseDate: new Date(m.release_date!) } as CalendarEvent))];
      }

      if (filter === 'all' || filter === 'tv') {
        const tvShows = await discoverMedia('tv', {
          'first_air_date.gte': gte,
          'first_air_date.lte': lte,
          sort_by: 'popularity.desc'
        });
        fetchedEvents = [...fetchedEvents, ...tvShows.map(s => ({ ...s, releaseDate: new Date(s.first_air_date!) } as CalendarEvent))];
      }

      // Process and sort
      return fetchedEvents
        .filter(e => !isNaN(e.releaseDate.getTime()))
        .filter((v, i, a) => a.findIndex(t => t.id === v.id && t.releaseDate.getTime() === v.releaseDate.getTime()) === i)
        .sort((a, b) => b.popularity - a.popularity);
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const toggleReminder = async (event: CalendarEvent) => {
    const existing = reminders.find(r => r.mediaId === event.id && r.mediaType === event.media_type);
    
    if (existing) {
      await db.reminders.delete(existing.id!);
      // TODO: Cancel notification
    } else {
      const reminder: Reminder = {
        mediaId: event.id,
        mediaType: event.media_type as 'movie' | 'tv',
        title: event.title || event.name || 'Unknown',
        releaseDate: format(event.releaseDate, 'yyyy-MM-dd'),
        posterPath: event.poster_path || undefined,
        remindAt: event.releaseDate.getTime() - (24 * 60 * 60 * 1000) // 24 hours before
      };
      
      await db.reminders.add(reminder);
      
      // Schedule notification
      if ('Notification' in window && Notification.permission === 'granted') {
         new Notification(`Reminder set for ${reminder.title}`, {
           body: `Releases on ${reminder.releaseDate}`
         });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
             new Notification(`Reminder set for ${reminder.title}`, {
               body: `Releases on ${reminder.releaseDate}`
             });
          }
        });
      }
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate))
  });

  const getEventsForDay = (day: Date) => {
    return events.filter(e => isSameDay(e.releaseDate, day));
  };

  const handleEventMouseEnter = (event: CalendarEvent, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredEvent({
      event,
      position: { x: rect.right + 10, y: rect.top }
    });
  };

  const handleEventMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredEvent(null);
    }, 300); // Small delay to allow moving to the popup
  };

  return (
    <div className="h-full flex flex-col p-8 overflow-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8 shrink-0 relative z-10">
        <div>
          <h1 className="text-4xl font-bold bg-linear-to-r from-white to-white/60 bg-clip-text text-transparent">
            Release Calendar
          </h1>
          <p className="text-textSecondary mt-1">
            Your personalized guide to upcoming entertainment
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 backdrop-blur-sm">
            <button 
              onClick={() => setViewMode('month')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'month' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'hover:bg-white/10 text-textSecondary'}`}
            >
              <CalendarIcon size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'hover:bg-white/10 text-textSecondary'}`}
            >
              <List size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10 backdrop-blur-sm">
            <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronLeft size={20} />
            </button>
            <span className="w-32 text-center font-medium text-lg">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <button 
            onClick={goToToday}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-sm font-medium transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 shrink-0 relative z-10">
        <button 
          onClick={() => setFilter('all')}
          className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${filter === 'all' ? 'bg-white text-black border-white shadow-lg shadow-white/10 scale-105' : 'bg-white/5 border-white/10 text-textSecondary hover:bg-white/10 hover:text-white'}`}
        >
          All Releases
        </button>
        <button 
          onClick={() => setFilter('movie')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${filter === 'movie' ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20 scale-105' : 'bg-white/5 border-white/10 text-textSecondary hover:bg-white/10 hover:text-white'}`}
        >
          <Film size={16} /> Movies
        </button>
        <button 
          onClick={() => setFilter('tv')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${filter === 'tv' ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-600/20 scale-105' : 'bg-white/5 border-white/10 text-textSecondary hover:bg-white/10 hover:text-white'}`}
        >
          <Tv size={16} /> TV Shows
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-4 relative z-10 custom-scrollbar">
        {loading && events.length === 0 ? (
           <div className="flex items-center justify-center h-96">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary shadow-[0_0_15px_rgba(124,58,237,0.5)]"></div>
           </div>
        ) : viewMode === 'month' ? (
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center py-2 text-xs font-bold uppercase tracking-widest text-textSecondary/70">
                {day}
              </div>
            ))}
            {daysInMonth.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDate = isToday(day);
              
              // Sort day events by popularity to show best first
              dayEvents.sort((a, b) => b.popularity - a.popularity);
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={`
                    min-h-[140px] rounded-2xl p-2 relative group overflow-hidden transition-all duration-300
                    ${!isCurrentMonth ? 'opacity-30 grayscale' : 'bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10'}
                    ${isTodayDate ? 'ring-2 ring-primary shadow-[0_0_20px_rgba(124,58,237,0.3)] bg-primary/5' : ''}
                  `}
                >
                  {/* Date Number */}
                  <div className={`
                    absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold z-20
                    ${isTodayDate ? 'bg-primary text-white shadow-lg' : 'text-white/60 bg-black/20 backdrop-blur-sm'}
                  `}>
                    {format(day, 'd')}
                  </div>

                  {/* Content */}
                  <div className="h-full flex flex-col gap-1.5 mt-6">
                    {dayEvents.slice(0, 3).map((event, idx) => {
                       const isReminderSet = reminders.some(r => r.mediaId === event.id && r.mediaType === event.media_type);
                       
                       // Featured item (first one) gets special treatment
                       if (idx === 0) {
                         return (
                           <div
                              key={`${event.media_type}-${event.id}`}
                              className="relative aspect-video w-full rounded-lg overflow-hidden cursor-pointer shadow-lg group/item"
                              onClick={() => navigate(`/details/${event.media_type}/${event.id}`)}
                              onMouseEnter={(e) => handleEventMouseEnter(event, e)}
                              onMouseLeave={handleEventMouseLeave}
                           >
                             <img 
                               src={getImageUrl(event.backdrop_path || event.poster_path)} 
                               alt={event.title}
                               className="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-110"
                             />
                             <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent p-2 flex flex-col justify-end">
                               <p className="text-[10px] font-bold text-white line-clamp-1 leading-tight">
                                 {event.title || event.name}
                               </p>
                               {event.isEpisode && (
                                 <p className="text-[8px] text-purple-300 font-medium truncate">
                                   {event.episodeInfo?.split(':')[0]}
                                 </p>
                               )}
                             </div>
                             {isReminderSet && (
                               <div className="absolute top-1 left-1 bg-primary text-white p-0.5 rounded-full shadow-md">
                                 <Bell size={8} fill="currentColor" />
                               </div>
                             )}
                           </div>
                         );
                       }

                       // Secondary items
                       return (
                        <div
                          key={`${event.media_type}-${event.id}`}
                          className="flex items-center gap-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                          onClick={() => navigate(`/details/${event.media_type}/${event.id}`)}
                          onMouseEnter={(e) => handleEventMouseEnter(event, e)}
                          onMouseLeave={handleEventMouseLeave}
                        >
                          <div className="w-5 h-7 shrink-0 rounded overflow-hidden bg-black/50">
                            <img src={getImageUrl(event.poster_path)} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[10px] font-medium text-textSecondary truncate">
                            {event.title || event.name}
                          </span>
                        </div>
                      );
                    })}
                    
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-center text-textSecondary font-medium pt-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {events.map(event => {
               const isReminderSet = reminders.some(r => r.mediaId === event.id && r.mediaType === event.media_type);
               
               return (
              <Focusable
                key={`${event.media_type}-${event.id}`}
                onClick={() => navigate(`/details/${event.media_type}/${event.id}`)}
                className="group relative flex gap-6 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 hover:border-white/20 transition-all"
              >
                <div className="w-24 h-36 shrink-0 rounded-xl overflow-hidden shadow-lg">
                  <img 
                    src={getImageUrl(event.poster_path)} 
                    alt={event.title || event.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 py-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-textSecondary mb-2">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium uppercase tracking-wider ${event.media_type === 'movie' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                          {event.isEpisode ? 'New Episode' : (event.media_type === 'movie' ? 'Movie' : 'TV Show')}
                        </span>
                        <span>•</span>
                        <span>{format(event.releaseDate, 'MMMM d, yyyy')}</span>
                      </div>
                      <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                        {event.title || event.name}
                      </h3>
                      {event.isEpisode && (
                        <p className="text-sm font-medium text-purple-300 mb-2">
                          {event.episodeInfo}
                        </p>
                      )}
                      <p className="text-sm text-textSecondary line-clamp-2 max-w-2xl">
                        {event.overview}
                      </p>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReminder(event);
                      }}
                      className={`
                        p-3 rounded-full transition-all
                        ${isReminderSet 
                          ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary/90' 
                          : 'bg-white/5 text-textSecondary hover:bg-white/10 hover:text-white'}
                      `}
                      title={isReminderSet ? "Remove reminder" : "Add reminder"}
                    >
                      {isReminderSet ? <CheckCircle size={20} /> : <Bell size={20} />}
                    </button>
                  </div>
                </div>
              </Focusable>
            )})}
            
            {events.length === 0 && (
              <div className="text-center py-20 text-textSecondary">
                No releases found for this month.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Genius Hover Portal */}
      <AnimatePresence>
        {hoveredEvent && (
          <GeniusHoverCard 
            event={hoveredEvent.event}
            position={hoveredEvent.position}
            onClose={() => setHoveredEvent(null)}
            onToggleReminder={(e) => {
              e.stopPropagation();
              toggleReminder(hoveredEvent.event);
            }}
            isReminderSet={reminders.some(r => r.mediaId === hoveredEvent.event.id && r.mediaType === hoveredEvent.event.media_type)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CalendarPage;
