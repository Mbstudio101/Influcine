import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../db';
import { useAuth } from '../context/useAuth';
import { MediaDetails } from '../types';

interface UsePlayerProgressProps {
  type: 'movie' | 'tv';
  id: string;
  details: MediaDetails | undefined;
  season?: number;
  episode?: number;
  urlSeason?: string | null;
  urlEpisode?: string | null;
}

export const usePlayerProgress = ({
  type,
  id,
  details,
  season,
  episode,
  urlSeason,
  urlEpisode
}: UsePlayerProgressProps) => {
  const { profile } = useAuth();
  const [initialStartTime, setInitialStartTime] = useState(0);
  const [restoredSeason, setRestoredSeason] = useState<number | null>(null);
  const [restoredEpisode, setRestoredEpisode] = useState<number | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);

  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingProgressRef = useRef<{currentTime: number, duration: number} | null>(null);
  
  // Refs for stable access in async callbacks to avoid closure staleness
  const detailsRef = useRef(details);
  const profileRef = useRef(profile);
  const argsRef = useRef({ type, id, season, episode });

  useEffect(() => {
    detailsRef.current = details;
    profileRef.current = profile;
    argsRef.current = { type, id, season, episode };
  }, [details, profile, type, id, season, episode]);

  // Load saved progress
  useEffect(() => {
    const loadProgress = async () => {
      if (!type || !id) return;
      
      setIsLoadingProgress(true);
      try {
        const saved = await db.history.get(parseInt(id));
        if (saved?.progress) {
          // Restore season/episode for TV shows ONLY if URL params are missing
          if (!urlSeason && !urlEpisode && type === 'tv' && saved.progress.season && saved.progress.episode) {
            setRestoredSeason(saved.progress.season);
            setRestoredEpisode(saved.progress.episode);
          }
          
          // Set start time if not finished (e.g. < 95%)
          if (saved.progress.percentage < 95) {
            const currentSeason = urlSeason ? parseInt(urlSeason) : (season || saved.progress.season);
            const currentEpisode = urlEpisode ? parseInt(urlEpisode) : (episode || saved.progress.episode);
            
            // Only resume if we are playing the same episode/movie
            if (type === 'movie' || (saved.progress.season === currentSeason && saved.progress.episode === currentEpisode)) {
              setInitialStartTime(saved.progress.watched);
            }
          }
        }
      } catch (error) {
        // console.error('Failed to load progress:', error);
      } finally {
        setIsLoadingProgress(false);
      }
    };
    
    loadProgress();
  }, [type, id, urlSeason, urlEpisode, season, episode]); // Added season/episode dependencies to be safe, though mainly runs on mount/id change

  const performSave = useCallback(async (currentTime: number, duration: number) => {
    const currentDetails = detailsRef.current;
    const currentProfile = profileRef.current;
    const { type: currentType, id: currentId, season: currentSeason, episode: currentEpisode } = argsRef.current;

    if (!currentDetails || !currentDetails.id) return;

    const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
    
    try {
      // Explicitly construct the object to avoid Dexie errors with complex/circular types
      const historyItem = {
        id: Number(currentDetails.id),
        title: currentDetails.title,
        name: currentDetails.name,
        poster_path: currentDetails.poster_path,
        backdrop_path: currentDetails.backdrop_path,
        overview: currentDetails.overview,
        vote_average: currentDetails.vote_average,
        media_type: currentDetails.media_type,
        savedAt: Date.now(),
        progress: {
          watched: currentTime,
          duration: duration,
          percentage: percentage,
          lastUpdated: Date.now(),
          season: currentType === 'tv' ? currentSeason : undefined,
          episode: currentType === 'tv' ? currentEpisode : undefined
        }
      };

      // Clone object to ensure no hidden properties or non-cloneable types
      const cleanItem = JSON.parse(JSON.stringify(historyItem));
      await db.history.put(cleanItem);
      
      if (currentType === 'tv' && currentProfile?.id) {
        const episodeItem = {
          profileId: currentProfile.id,
          showId: Number(currentId),
          season: currentSeason,
          episode: currentEpisode,
          watchedSeconds: currentTime,
          durationSeconds: duration,
          percentage,
          lastUpdated: Date.now()
        };
        const cleanEpisode = JSON.parse(JSON.stringify(episodeItem));
        await db.episodeProgress.put(cleanEpisode);
      }
    } catch (err) {
      // console.error('Error saving progress:', err);
    }
  }, []);

  const saveProgress = useCallback(async (currentTime: number, duration: number) => {
    pendingProgressRef.current = { currentTime, duration };

    if (!saveTimeoutRef.current) {
      saveTimeoutRef.current = setTimeout(async () => {
        if (pendingProgressRef.current) {
          await performSave(pendingProgressRef.current.currentTime, pendingProgressRef.current.duration);
        }
        saveTimeoutRef.current = null;
      }, 5000); // 5 seconds debounce
    }
  }, [performSave]);

  const flushProgress = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingProgressRef.current) {
      await performSave(pendingProgressRef.current.currentTime, pendingProgressRef.current.duration);
      pendingProgressRef.current = null;
    }
  }, [performSave]);

  // Flush on unmount
  useEffect(() => {
      return () => {
          flushProgress();
      };
  }, [flushProgress]);

  return {
    initialStartTime,
    restoredSeason,
    restoredEpisode,
    isLoadingProgress,
    saveProgress,
    flushProgress
  };
};
