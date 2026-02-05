import { useLiveQuery } from 'dexie-react-hooks';
import { db, SavedMedia } from '../db';
import { Media } from '../types';
import { useToast } from '../context/toast';
import { useCallback } from 'react';

export function useWatchlist(media: Media | null | undefined) {
  const { showToast } = useToast();

  const compat = media as unknown as {
    id?: number | string;
    tmdbId?: number | string;
    mediaId?: number | string;
  };
  
  // Ensure we get a valid numeric ID
  const rawId = compat?.id ?? compat?.tmdbId ?? compat?.mediaId;
  const stableId = rawId ? Number(rawId) : undefined;

  const savedItem = useLiveQuery(
    () => (stableId ? db.library.get(stableId) : undefined),
    [stableId]
  );
  
  const isSaved = !!savedItem;

  const toggleWatchlist = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!media || stableId == null || isNaN(stableId)) {
      if (import.meta.env.DEV) {
        // console.error('Failed to toggle library item: no valid id found.', media, stableId);
      }
      showToast('We could not identify this item.', 'error');
      return;
    }

    if (import.meta.env.DEV) {
      // console.log('[useWatchlist] Toggling item:', stableId, typeof stableId);
      // console.log('[useWatchlist] DB Schema for library:', db.library.schema.primKey);
    }

    if (isSaved) {
      db.library.delete(stableId)
        .then(() => showToast('Removed from your library.', 'info'))
        .catch(() => showToast('Could not update library.', 'error'));
    } else {
      const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
      
      // Ensure strictly serializable object with null fallbacks
      // Dexie/IndexedDB prefers null over undefined for nullable fields
      const payload: SavedMedia = {
          id: stableId,
          title: media.title || '',
          name: media.name || '',
          poster_path: media.poster_path ?? null,
          backdrop_path: media.backdrop_path ?? null,
          overview: media.overview || '',
          vote_average: Number(media.vote_average) || 0,
          release_date: media.release_date || undefined,
          first_air_date: media.first_air_date || undefined,
          media_type: mediaType as 'movie' | 'tv',
          savedAt: Date.now(),
      };
      
      // Add tmdbId only if it exists
      const mediaWithTmdb = media as { tmdbId?: number | string };
      if (mediaWithTmdb.tmdbId) {
          payload.tmdbId = Number(mediaWithTmdb.tmdbId);
      }

      // console.log('[useWatchlist] Saving payload:', payload);
      await db.library.put(payload)
        .then(() => showToast('Added to your library.', 'success'))
        .catch(() => showToast('Could not update library.', 'error'));
    }
  }, [media, isSaved, showToast, stableId]);

  return { isSaved, toggleWatchlist };
}
