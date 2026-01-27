import { useLiveQuery } from 'dexie-react-hooks';
import { db, SavedMedia } from '../db';
import { Media } from '../types';
import { useToast } from '../context/toast';
import { useCallback } from 'react';

export function useWatchlist(media: Media | null | undefined) {
  const { showToast } = useToast();

  const compat = media as unknown as {
    id?: number;
    tmdbId?: number;
    mediaId?: number;
  };
  const stableId = compat?.id ?? compat?.tmdbId ?? compat?.mediaId;

  const savedItem = useLiveQuery(
    () => (stableId != null ? db.watchlist.get(stableId) : undefined),
    [stableId]
  );
  
  const isSaved = !!savedItem;

  const toggleWatchlist = useCallback(async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!media || stableId == null) {
      console.error('Failed to toggle library item: no valid id found.', media);
      showToast('We could not identify this item.', 'error');
      return;
    }

    try {
      if (isSaved) {
        await db.watchlist.delete(stableId);
        showToast('Removed from your library.', 'info');
      } else {
        const mediaType = media.media_type || (media.title ? 'movie' : 'tv');
        const payload: SavedMedia = {
            id: stableId,
            title: media.title,
            name: media.name,
            poster_path: media.poster_path,
            backdrop_path: media.backdrop_path,
            overview: media.overview,
            vote_average: media.vote_average,
            release_date: media.release_date,
            first_air_date: media.first_air_date,
            media_type: mediaType as 'movie' | 'tv',
            savedAt: Date.now(),
            ...((media as { tmdbId?: number }).tmdbId ? { tmdbId: (media as { tmdbId?: number }).tmdbId } : {}),
        };
        
        await db.watchlist.put(payload);
        showToast('Added to your library.', 'success');
      }
    } catch (error) {
      console.error('Failed to update library:', error);
      showToast('Failed to update your library.', 'error');
    }
  }, [media, stableId, isSaved, showToast]);

  return { isSaved, toggleWatchlist };
}
