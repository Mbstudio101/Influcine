import { useState, useEffect } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  eachDayOfInterval, isSameMonth, isSameDay, isToday, 
  startOfWeek, endOfWeek 
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, 
  Film, Tv, Bell, CheckCircle 
} from 'lucide-react';
import { Media } from '../types';
import { discoverMedia, getDetails } from '../services/tmdb';
import { getImageUrl } from '../services/tmdb';
import { db, Reminder } from '../db';
import Focusable from '../components/Focusable';
import { useNavigate } from 'react-router-dom';

type ViewMode = 'month' | 'list';
type FilterType = 'all' | 'movie' | 'tv';

interface CalendarEvent extends Media {
  releaseDate: Date;
  isReminderSet?: boolean;
  isEpisode?: boolean;
  episodeInfo?: string;
}

const CalendarPage = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [filter, setFilter] = useState<FilterType>('all');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    fetchEvents();
    loadReminders();
  }, [currentDate, filter]);

  const loadReminders = async () => {
    const allReminders = await db.reminders.toArray();
    setReminders(allReminders);
  };

  const fetchEvents = async () => {
    setLoading(true);
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    
    // Format dates for API (YYYY-MM-DD)
    const gte = format(subMonths(start, 0), 'yyyy-MM-dd'); // Fetch a bit more?
    const lte = format(addMonths(end, 0), 'yyyy-MM-dd');

    try {
      let fetchedEvents: CalendarEvent[] = [];

      // 1. Fetch Watchlist Next Episodes (Priority)
      if (filter === 'all' || filter === 'tv') {
        const watchlist = await db.watchlist.where('media_type').equals('tv').toArray();
        const watchlistPromises = watchlist.map(async (show) => {
          try {
            // Only fetch if we suspect it might have a new episode (e.g. ongoing)
            // For now, fetch all TV shows in watchlist to be safe
            const details = await getDetails('tv', show.id);
            if (details.next_episode_to_air) {
               const airDate = new Date(details.next_episode_to_air.air_date);
               // Check if within current view range
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
          sort_by: 'primary_release_date.asc'
        });
        fetchedEvents = [...fetchedEvents, ...movies.map(m => ({ ...m, releaseDate: new Date(m.release_date!) } as CalendarEvent))];
      }

      if (filter === 'all' || filter === 'tv') {
        const tvShows = await discoverMedia('tv', {
          'first_air_date.gte': gte,
          'first_air_date.lte': lte,
          sort_by: 'first_air_date.asc'
        });
        // Filter out if already in watchlist events to avoid duplicates (though one is show launch, one is episode)
        // Actually, discover TV usually returns *new* shows starting, not new episodes of existing shows.
        // So keeping both is fine.
        fetchedEvents = [...fetchedEvents, ...tvShows.map(s => ({ ...s, releaseDate: new Date(s.first_air_date!) } as CalendarEvent))];
      }

      // Process and sort
      const processedEvents = fetchedEvents
        .filter(e => !isNaN(e.releaseDate.getTime()))
        // Remove duplicates by ID + Date (if any)
        .filter((v, i, a) => a.findIndex(t => t.id === v.id && t.releaseDate.getTime() === v.releaseDate.getTime()) === i)
        .sort((a, b) => a.releaseDate.getTime() - b.releaseDate.getTime());

      setEvents(processedEvents);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleReminder = async (event: CalendarEvent) => {
    const existing = reminders.find(r => r.mediaId === event.id && r.mediaType === event.media_type);
    
    if (existing) {
      await db.reminders.delete(existing.id!);
      setReminders(prev => prev.filter(r => r.id !== existing.id));
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
      
      const id = await db.reminders.add(reminder);
      setReminders(prev => [...prev, { ...reminder, id } as Reminder]);
      
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

  return (
    <div className="h-full flex flex-col p-8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Release Calendar
          </h1>
          <p className="text-textSecondary mt-1">
            Discover upcoming movies and TV shows
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
            <button 
              onClick={() => setViewMode('month')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'month' ? 'bg-primary text-white' : 'hover:bg-white/10 text-textSecondary'}`}
            >
              <CalendarIcon size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'hover:bg-white/10 text-textSecondary'}`}
            >
              <List size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
            <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-lg">
              <ChevronLeft size={20} />
            </button>
            <span className="w-32 text-center font-medium">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-lg">
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
      <div className="flex gap-2 mb-6 shrink-0">
        <button 
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${filter === 'all' ? 'bg-white/20 border-white/20 text-white' : 'bg-transparent border-white/10 text-textSecondary hover:bg-white/5'}`}
        >
          All Releases
        </button>
        <button 
          onClick={() => setFilter('movie')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${filter === 'movie' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-transparent border-white/10 text-textSecondary hover:bg-white/5'}`}
        >
          <Film size={16} /> Movies
        </button>
        <button 
          onClick={() => setFilter('tv')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${filter === 'tv' ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-transparent border-white/10 text-textSecondary hover:bg-white/5'}`}
        >
          <Tv size={16} /> TV Shows
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-4">
        {loading && events.length === 0 ? (
           <div className="flex items-center justify-center h-64">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
           </div>
        ) : viewMode === 'month' ? (
          <div className="grid grid-cols-7 gap-px bg-white/10 rounded-2xl overflow-hidden border border-white/10">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-background/95 p-3 text-center text-sm font-medium text-textSecondary">
                {day}
              </div>
            ))}
            {daysInMonth.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isTodayDate = isToday(day);
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={`min-h-[120px] bg-background/95 p-2 hover:bg-white/5 transition-colors relative group
                    ${!isCurrentMonth ? 'opacity-30' : ''}
                  `}
                >
                  <div className={`flex justify-between items-start mb-2`}>
                    <span className={`
                      w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium
                      ${isTodayDate ? 'bg-primary text-white shadow-lg shadow-primary/50' : 'text-textSecondary'}
                    `}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    {dayEvents.map(event => {
                       const isReminderSet = reminders.some(r => r.mediaId === event.id && r.mediaType === event.media_type);
                       
                       return (
                        <Focusable
                          key={`${event.media_type}-${event.id}`}
                          onClick={() => navigate(`/${event.media_type}/${event.id}`)}
                          className="block"
                        >
                          <div className={`
                            text-xs p-1.5 rounded-lg truncate flex items-center gap-1.5
                            ${event.media_type === 'movie' ? 'bg-blue-500/10 text-blue-300' : 'bg-purple-500/10 text-purple-300'}
                            ${event.isEpisode ? 'border border-purple-500/50 shadow-[0_0_8px_rgba(168,85,247,0.3)]' : 'border border-transparent hover:border-white/10'}
                            hover:brightness-125 cursor-pointer transition-all
                          `}>
                            {isReminderSet && <Bell size={10} className="fill-current" />}
                            <span className="truncate font-medium">{event.title || event.name}</span>
                            {event.isEpisode && <span className="opacity-75 text-[10px] ml-1 hidden sm:inline">{event.episodeInfo?.split(':')[0]}</span>}
                          </div>
                        </Focusable>
                      );
                    })}
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
                onClick={() => navigate(`/${event.media_type}/${event.id}`)}
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
    </div>
  );
};

export default CalendarPage;
