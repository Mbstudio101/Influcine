import { useState, useRef, useEffect, useCallback } from 'react';
import { getVideos } from '../services/tmdb';
import { findBestTrailer } from '../utils/videoUtils';
import { electronService } from '../services/electron';
import { Media } from '../types';

export function useTrailerPrefetch(media: Media, mediaType: 'movie' | 'tv') {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const prefetchTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (prefetchTimeout.current) clearTimeout(prefetchTimeout.current);
    };
  }, []);

  const prefetch = useCallback(() => {
    if (!trailerKey) {
        prefetchTimeout.current = setTimeout(() => {
            getVideos(mediaType, media.id).then(videos => {
                const trailer = findBestTrailer(videos);
                if (trailer) {
                    setTrailerKey(trailer.key);
                    electronService.prefetchTrailer(trailer.key).catch(() => { /* prefetch is best-effort */ });
                }
            }).catch(() => { /* prefetch lookup is best-effort */ });
        }, 500);
    }
  }, [media.id, mediaType, trailerKey]);

  const cancelPrefetch = useCallback(() => {
    if (prefetchTimeout.current) {
      clearTimeout(prefetchTimeout.current);
    }
  }, []);

  const fetchTrailerNow = useCallback(async () => {
      if (trailerKey) return trailerKey;
      try {
          const videos = await getVideos(mediaType, media.id);
          const trailer = findBestTrailer(videos);
          if (trailer) {
              setTrailerKey(trailer.key);
              return trailer.key;
          }
          
          // Fallback: Search YouTube
          const title = media.title || media.name;
          if (title) {
             const searchKey = await electronService.searchTrailer(title);
             if (searchKey) {
                 setTrailerKey(searchKey);
                 return searchKey;
             }
          }

          return null;
      } catch (e) {
          console.warn('Failed to fetch trailer:', e);
          return null;
      }
  }, [media.id, mediaType, trailerKey, media.title, media.name]);

  return { trailerKey, prefetch, cancelPrefetch, fetchTrailerNow };
}
