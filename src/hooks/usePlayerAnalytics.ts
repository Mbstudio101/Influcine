import { useRef, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import { awardXP, unlockAchievement, updateWatchStats } from '../services/achievements';
import { MediaDetails } from '../types';
import { db } from '../db';

interface UsePlayerAnalyticsProps {
  type: 'movie' | 'tv';
  details: MediaDetails | undefined;
  season?: number;
  episode?: number;
}

export const usePlayerAnalytics = ({
  type,
  details,
  season,
  episode
}: UsePlayerAnalyticsProps) => {
  const { profile } = useAuth();
  
  const lastXPAwardTimeRef = useRef(0);
  const lastStatUpdateTimeRef = useRef(0);
  const accumulatedTimeRef = useRef(0); // seconds

  const trackPlayStart = useCallback(async (startTime: number) => {
    // Reset tracking baselines for this playback session
    lastXPAwardTimeRef.current = startTime;
    lastStatUpdateTimeRef.current = startTime;
    accumulatedTimeRef.current = 0;

    // Check Sleep/Time Achievements
    if (profile?.id) {
      const hour = new Date().getHours();
      // Night Owl: 00:00 - 04:00
      if (hour >= 0 && hour < 4) {
          await unlockAchievement(profile.id, 'night_owl', 1);
      }
    }

    // Save initial history (Continue Watching)
    try {
      if (details && details.id) {
        const numericId = Number(details.id);
        
        // Try to get existing progress to preserve it
        let duration = 0;
        let percentage = 0;
        let watched = startTime;
        
        try {
          const existing = await db.history.get(numericId);
          if (existing?.progress) {
            if (existing.progress.duration) {
              duration = existing.progress.duration;
            }
            if (typeof existing.progress.watched === 'number') {
              watched = existing.progress.watched;
            }
            if (duration > 0) {
              percentage = (watched / duration) * 100;
            }
          }
        } catch (e) {
          // Ignore read error
        }

        const historyItem = {
          id: numericId,
          title: details.title,
          name: details.name,
          poster_path: details.poster_path,
          backdrop_path: details.backdrop_path,
          overview: details.overview,
          vote_average: details.vote_average,
          media_type: details.media_type,
          savedAt: Date.now(),
          progress: {
            watched: watched,
            duration: duration,
            percentage: percentage,
            lastUpdated: Date.now(),
            season: type === 'tv' ? season : undefined,
            episode: type === 'tv' ? episode : undefined
          }
        };

        const cleanItem = JSON.parse(JSON.stringify(historyItem));
        await db.history.put(cleanItem);
        
        if (type === 'tv' && profile?.id) {
          const episodeItem = {
            profileId: profile.id,
            showId: numericId,
            season,
            episode,
            watchedSeconds: watched,
            durationSeconds: duration,
            percentage,
            lastUpdated: Date.now()
          };
          const cleanEpisode = JSON.parse(JSON.stringify(episodeItem));
          await db.episodeProgress.put(cleanEpisode);
        }
      }
    } catch (err) {
      console.error('Error saving history on play:', err);
    }
  }, [profile, type, season, episode, details]);

  const flushWatchTime = useCallback(async () => {
    if (!profile?.id) return;
    if (accumulatedTimeRef.current <= 0) return;

    const minutes = accumulatedTimeRef.current / 60;
    accumulatedTimeRef.current = 0;

    await updateWatchStats(profile.id, { minutesWatched: minutes });
  }, [profile]);

  const trackTimeUpdate = useCallback(async (currentTime: number) => {
    if (!profile?.id) return;

    // Initialize baseline on first meaningful update.
    if (lastStatUpdateTimeRef.current === 0) {
      lastStatUpdateTimeRef.current = currentTime;
      lastXPAwardTimeRef.current = currentTime;
      return;
    }

    // XP Accumulation (every 5 mins = 300s)
    if (currentTime - lastXPAwardTimeRef.current >= 300) {
        await awardXP(profile.id, 20); // 20 XP per 5 mins
        lastXPAwardTimeRef.current = currentTime;
    }

    // Stats accumulation based on elapsed playback seconds.
    const delta = currentTime - lastStatUpdateTimeRef.current;
    // Ignore jumps from seeking or stream desync spikes.
    if (delta > 0 && delta <= 15) {
      accumulatedTimeRef.current += delta;
    }
    lastStatUpdateTimeRef.current = currentTime;

    if (accumulatedTimeRef.current >= 60) {
        const fullMinutes = Math.floor(accumulatedTimeRef.current / 60);
        await updateWatchStats(profile.id, { minutesWatched: fullMinutes });
        accumulatedTimeRef.current -= fullMinutes * 60;
    }
  }, [profile]);

  const trackPause = useCallback(async () => {
    await flushWatchTime();
  }, [flushWatchTime]);

  const trackEnded = useCallback(async () => {
    if (!profile?.id) return;
    await flushWatchTime();

    // 1. Award Bonus XP
    const bonus = type === 'movie' ? 150 : 75;
    await awardXP(profile.id, bonus);

    // Track Movies/Series Watched
    if (type === 'movie') {
        await updateWatchStats(profile.id, { movieCompleted: true });
    } else {
        await updateWatchStats(profile.id, { seriesCompleted: true });
    }

    // 2. Track Binge Watching (Session Storage)
    let sessionCount = parseInt(sessionStorage.getItem('influcine_session_watch_count') || '0');
    sessionCount++;
    sessionStorage.setItem('influcine_session_watch_count', sessionCount.toString());
    
    await unlockAchievement(profile.id, 'binge_watcher', sessionCount);

    // 3. Track Early Bird (4AM - 6AM finish)
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 6) {
        await unlockAchievement(profile.id, 'early_bird', 1);
    }

    // 4. Taste Achievements
    if (details?.genres) {
        const isDrama = details.genres.some(g => g.name.toLowerCase().includes('drama'));
        if (isDrama) {
            // Track total dramas watched
            const historyCount = await db.history.filter(h => 
              (h.media_type === 'movie' || h.media_type === 'tv') &&
              (h.genres?.some(g => g.name.toLowerCase().includes('drama')) || false)
            ).count();
            
            await unlockAchievement(profile.id, 'drama_queen', historyCount); 
        }
    }
  }, [profile, type, details, flushWatchTime]);

  return {
    trackPlayStart,
    trackTimeUpdate,
    trackPause,
    trackEnded
  };
};
