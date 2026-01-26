import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Reminder } from '../db';
import MediaCard from '../components/MediaCard';
import Focusable from '../components/Focusable';
import { useNavigate } from 'react-router-dom';
import { addMonths, endOfWeek, format, startOfWeek } from 'date-fns';
import { getDetails, getImageUrl } from '../services/tmdb';
import { Bell, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface LibraryUpcomingEvent {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  date: Date;
  posterPath?: string | null;
  isEpisode: boolean;
  episodeInfo?: string;
}

const Watchlist: React.FC = () => {
  const watchlist = useLiveQuery(() => db.watchlist.toArray());
  const [upcoming, setUpcoming] = useState<LibraryUpcomingEvent[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUpcoming = async () => {
      if (!watchlist || watchlist.length === 0) {
        setUpcoming([]);
        return;
      }

      setLoadingUpcoming(true);
      try {
        const today = new Date();
        const horizon = addMonths(today, 2);

        const tvItems = watchlist.filter(item => item.media_type === 'tv');
        const tvPromises = tvItems.map(async (show) => {
          try {
            const details = await getDetails('tv', show.id);
            if (details.next_episode_to_air) {
              const airDate = new Date(details.next_episode_to_air.air_date);
              if (airDate >= today && airDate <= horizon) {
                return {
                  mediaId: show.id,
                  mediaType: 'tv' as const,
                  title: show.name || show.title || 'Unknown',
                  date: airDate,
                  posterPath: details.next_episode_to_air.still_path || show.poster_path,
                  isEpisode: true,
                  episodeInfo: `S${details.next_episode_to_air.season_number}E${details.next_episode_to_air.episode_number}: ${details.next_episode_to_air.name}`
                } as LibraryUpcomingEvent;
              }
            }
          } catch (error) {
            console.error('Failed to load TV details for library calendar', error);
          }
          return null;
        });

        const tvEvents = (await Promise.all(tvPromises)).filter(
          (e): e is LibraryUpcomingEvent => e !== null
        );

        const movieItems = watchlist.filter(item => item.media_type === 'movie');
        const movieEvents: LibraryUpcomingEvent[] = movieItems
          .map((movie) => {
            const dateStr = movie.release_date;
            if (!dateStr) return null;
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            if (date < today || date > horizon) return null;
            return {
              mediaId: movie.id,
              mediaType: 'movie' as const,
              title: movie.title || 'Unknown',
              date,
              posterPath: movie.poster_path,
              isEpisode: false
            } as LibraryUpcomingEvent;
          })
          .filter((e): e is LibraryUpcomingEvent => e !== null);

        const allEvents = [...tvEvents, ...movieEvents]
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        setUpcoming(allEvents);
      } finally {
        setLoadingUpcoming(false);
      }
    };

    loadUpcoming();
  }, [watchlist]);

  useEffect(() => {
    const loadReminders = async () => {
      const all = await db.reminders.toArray();
      setReminders(all);
    };
    loadReminders();
  }, []);

  const toggleReminder = async (event: LibraryUpcomingEvent) => {
    const existing = reminders.find(
      (r) => r.mediaId === event.mediaId && r.mediaType === event.mediaType
    );

    if (existing && existing.id != null) {
      await db.reminders.delete(existing.id);
      setReminders((prev) => prev.filter((r) => r.id !== existing.id));
      return;
    }

    const releaseDate = format(event.date, 'yyyy-MM-dd');
    const reminder: Reminder = {
      mediaId: event.mediaId,
      mediaType: event.mediaType,
      title: event.title,
      releaseDate,
      posterPath: event.posterPath || undefined,
      remindAt: event.date.getTime() - 24 * 60 * 60 * 1000
    };

    const id = await db.reminders.add(reminder);
    const saved = { ...reminder, id } as Reminder;
    setReminders((prev) => [...prev, saved]);

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Reminder set for ${reminder.title}`, {
        body: `Releases on ${reminder.releaseDate}`
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(`Reminder set for ${reminder.title}`, {
            body: `Releases on ${reminder.releaseDate}`
          });
        }
      });
    }
  };

  const groupedUpcoming = useMemo(() => {
    if (upcoming.length === 0) return [];

    const today = new Date();
    const groups = new Map<
      string,
      { label: string; items: LibraryUpcomingEvent[]; start: Date }
    >();

    for (const event of upcoming) {
      const start = startOfWeek(event.date, { weekStartsOn: 1 });
      const end = endOfWeek(event.date, { weekStartsOn: 1 });
      const key = start.toISOString();

      if (!groups.has(key)) {
        const isThisWeek = start <= today && today <= end;
        const label = isThisWeek ? 'This Week' : format(start, "'Week of' MMM d");
        groups.set(key, { label, items: [], start });
      }

      groups.get(key)!.items.push(event);
    }

    return Array.from(groups.values()).sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );
  }, [upcoming]);

  if (!watchlist) return null;

  return (
    <div className="h-full overflow-y-auto pt-24 px-10 pb-20 scrollbar-hide">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold">My Library</h1>
        <span className="bg-white/10 px-3 py-1 rounded-full text-sm font-medium text-textSecondary">
          {watchlist.length} Items
        </span>
      </div>

      {import.meta.env.DEV && (
        <div className="mb-4 text-xs text-gray-400">
          Debug: {watchlist.length} items in local watchlist
          {watchlist[0] && (
            <> — first: "{watchlist[0].title || watchlist[0].name}" (id {watchlist[0].id})</>
          )}
        </div>
      )}

      {watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">📂</span>
          </div>
          <p className="text-xl font-medium mb-2">Your library is empty</p>
          <p className="text-sm">Add movies and shows to access them quickly.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {watchlist.map((item) => (
              <MediaCard key={item.id} media={item} />
            ))}
          </div>

          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">Release Calendar</h2>
                <p className="text-sm text-textSecondary">
                  Upcoming movies, shows, and anime from your library
                </p>
              </div>
            </div>

            {loadingUpcoming ? (
              <div className="flex items-center justify-center h-24 text-textSecondary">
                Loading upcoming releases...
              </div>
            ) : upcoming.length === 0 ? (
              <div className="text-sm text-textSecondary">
                No upcoming releases for your library in the next 60 days.
              </div>
            ) : (
              <div className="space-y-4">
                {groupedUpcoming.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <div className="text-xs font-semibold text-textSecondary uppercase tracking-wide">
                      {group.label}
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                      {group.items.map((event, index) => {
                        const isReminderSet = reminders.some(
                          (r) =>
                            r.mediaId === event.mediaId &&
                            r.mediaType === event.mediaType
                        );

                        return (
                          <Focusable
                            key={`${event.mediaType}-${event.mediaId}-${event.date.toISOString()}`}
                            className="min-w-[220px] max-w-[220px] bg-white/5 border border-white/10 rounded-2xl overflow-hidden cursor-pointer hover:bg-white/10 transition-all"
                            activeClassName="ring-2 ring-primary scale-[1.02]"
                            onClick={() =>
                              navigate(`/details/${event.mediaType}/${event.mediaId}`)
                            }
                          >
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.03 }}
                              className="h-full"
                            >
                              <div className="relative h-32 w-full">
                                {event.posterPath && (
                                  <img
                                    src={getImageUrl(event.posterPath)}
                                    alt={event.title}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />
                                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                                  <div className="text-xs font-semibold text-white line-clamp-2">
                                    {event.title}
                                  </div>
                                  <div className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-black/50 text-white/80 uppercase tracking-wide">
                                    {event.mediaType === 'movie' ? 'Movie' : 'TV'}
                                  </div>
                                </div>
                              </div>
                              <div className="p-3 space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-textSecondary">
                                    {format(event.date, 'EEE, MMM d')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleReminder(event);
                                    }}
                                    className={`p-1.5 rounded-full transition-colors ${
                                      isReminderSet
                                        ? 'bg-primary text-white'
                                        : 'bg-white/10 text-textSecondary hover:bg-white/20 hover:text-white'
                                    }`}
                                    aria-label={
                                      isReminderSet
                                        ? 'Remove reminder'
                                        : 'Add reminder'
                                    }
                                  >
                                    {isReminderSet ? (
                                      <CheckCircle size={14} />
                                    ) : (
                                      <Bell size={14} />
                                    )}
                                  </button>
                                </div>
                                {event.isEpisode && event.episodeInfo && (
                                  <div className="text-[11px] text-purple-300 line-clamp-2">
                                    {event.episodeInfo}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </Focusable>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Watchlist;
