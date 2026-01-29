import { useMemo, useState } from 'react';
import { Media } from '../types';

export type FilterType = 'all' | 'movie' | 'tv';

export const useSearchFilter = (results: Media[] = []) => {
  const [filterType, setFilterType] = useState<FilterType>('all');

  const filteredResults = useMemo(() => {
    return results.filter(item => {
      // Basic validity check (must have title/name and some ID)
      if (!item.id && !item.imdb_id) return false;
      if (!item.title && !item.name) return false;
      
      // Filter by type
      if (filterType === 'all') {
        return item.media_type === 'movie' || item.media_type === 'tv';
      }
      return item.media_type === filterType;
    });
  }, [results, filterType]);

  const counts = useMemo(() => {
    const movieCount = results.filter(i => i.media_type === 'movie').length;
    const tvCount = results.filter(i => i.media_type === 'tv').length;
    return {
      all: movieCount + tvCount,
      movie: movieCount,
      tv: tvCount
    };
  }, [results]);

  return {
    filterType,
    setFilterType,
    filteredResults,
    counts
  };
};
