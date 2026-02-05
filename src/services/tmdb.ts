import axios from 'axios';
import { Media, MediaDetails, Video, CastMember, Episode } from '../types';

const ACCESS_TOKEN = import.meta.env.VITE_TMDB_ACCESS_TOKEN;

const BASE_URL = 'https://api.themoviedb.org/3';

const tmdb = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json;charset=utf-8'
  }
});

// Helper to filter out broken items (missing images or invalid data)
const filterBroken = (items: Media[]): Media[] => {
  if (!Array.isArray(items)) return [];
  return items.filter(item => {
    // Must have ID
    if (!item.id) return false;
    
    // Must have title or name
    const hasTitle = (item.title && item.title.trim().length > 0) || (item.name && item.name.trim().length > 0);
    if (!hasTitle) return false;
    
    // Must have at least one valid image
    const hasPoster = item.poster_path && !item.poster_path.includes('via.placeholder.com');
    const hasBackdrop = item.backdrop_path && !item.backdrop_path.includes('via.placeholder.com');
    
    if (!hasPoster && !hasBackdrop) return false;
    
    return true;
  });
};

// Add logging interceptor
tmdb.interceptors.response.use(
  response => response,
  error => {
    // console.error('TMDB API Error:', {
    //   url: error.config?.url,
    //   status: error.response?.status,
    //   message: error.message
    // });
    return Promise.reject(error);
  }
);

// Direct API call without double caching (handled by React Query)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchApi = async <T>(url: string, params?: Record<string, any>): Promise<T> => {
  const response = await tmdb.get<T>(url, { params });
  return response.data;
};

export const getTrending = async (timeWindow: 'day' | 'week' = 'week'): Promise<Media[]> => {
  const data = await fetchApi<{ results: Media[] }>(`/trending/all/${timeWindow}`);
  return filterBroken(data.results);
};

export const searchMulti = async (query: string): Promise<Media[]> => {
  const data = await fetchApi<{ results: Media[] }>('/search/multi', { query });
  return filterBroken(data.results);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getDetails = async (type: 'movie' | 'tv', id: number, params?: Record<string, any>): Promise<MediaDetails> => {
  const data = await fetchApi<MediaDetails>(`/${type}/${id}`, {
    append_to_response: 'videos,credits,similar',
    ...params
  });
  return { ...data, media_type: type };
};

export const getVideos = async (type: 'movie' | 'tv', id: number): Promise<Video[]> => {
  const data = await fetchApi<{ results: Video[] }>(`/${type}/${id}/videos`);
  return data.results;
};

export const findMediaByImdbId = async (imdbId: string): Promise<Media | null> => {
  try {
    const data = await fetchApi<{ movie_results: Media[], tv_results: Media[] }>(`/find/${imdbId}`, {
      external_source: 'imdb_id'
    });
    
    const results = [
      ...(data.movie_results || []),
      ...(data.tv_results || [])
    ];
    
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    if (import.meta.env.DEV) {
      // console.warn('Failed to resolve IMDB ID:', error);
    }
    return null;
  }
};

export const getImageUrl = (path: string | null, size: 'w92' | 'w154' | 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500') => {
  if (!path) return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 750" width="500" height="750" style="background-color: %231a1a1a"%3E%3Ctext x="50%" y="50%" font-family="sans-serif" font-size="24" fill="%23666" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const getMoviesByCategory = async (category: 'popular' | 'top_rated' | 'now_playing' | 'upcoming'): Promise<Media[]> => {
  const data = await fetchApi<{ results: Media[] }>(`/movie/${category}`);
  const items = data.results.map((item) => ({ ...item, media_type: 'movie' } as Media));
  return filterBroken(items);
};

export const getTVShowsByCategory = async (category: 'popular' | 'top_rated' | 'on_the_air'): Promise<Media[]> => {
  const data = await fetchApi<{ results: Media[] }>(`/tv/${category}`);
  const items = data.results.map((item) => ({ ...item, media_type: 'tv' } as Media));
  return filterBroken(items);
};

export const getCredits = async (type: 'movie' | 'tv', id: number): Promise<{ cast: CastMember[] }> => {
  const data = await fetchApi<{ cast: CastMember[] }>(`/${type}/${id}/credits`);
  return data;
};

export const discoverMedia = async (
  type: 'movie' | 'tv',
  params: {
    with_genres?: string;
    without_genres?: string;
    sort_by?: string;
    'vote_count.gte'?: number;
    'vote_count.lte'?: number;
    'vote_average.gte'?: number;
    'primary_release_date.gte'?: string;
    'primary_release_date.lte'?: string;
    'first_air_date.gte'?: string;
    'first_air_date.lte'?: string;
    with_original_language?: string;
    page?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
): Promise<Media[]> => {
  const data = await fetchApi<{ results: Media[] }>(`/discover/${type}`, params);
  const items = data.results.map((item) => ({ ...item, media_type: type } as Media));
  return filterBroken(items);
};

export const getSimilar = async (type: 'movie' | 'tv', id: number): Promise<Media[]> => {
  const data = await fetchApi<{ results: Media[] }>(`/${type}/${id}/similar`);
  const items = data.results.map((item) => ({ ...item, media_type: type } as Media));
  return filterBroken(items);
};

export const getSeasonDetails = async (tvId: number, seasonNumber: number): Promise<{ episodes: Episode[] }> => {
  const data = await fetchApi<{ episodes: Episode[] }>(`/tv/${tvId}/season/${seasonNumber}`);
  return data;
};
