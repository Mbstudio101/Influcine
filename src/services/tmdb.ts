import axios from 'axios';
import { Media, MediaDetails, Video } from '../types';

const API_KEY = '8ba5ad53f165ef07eb5e1ba82622554e';

const BASE_URL = 'https://api.themoviedb.org/3';

const tmdb = axios.create({
  baseURL: BASE_URL,
  params: {
    api_key: API_KEY,
  },
});

export const getTrending = async (timeWindow: 'day' | 'week' = 'week'): Promise<Media[]> => {
  const response = await tmdb.get(`/trending/all/${timeWindow}`);
  return response.data.results;
};

export const searchMulti = async (query: string): Promise<Media[]> => {
  const response = await tmdb.get('/search/multi', {
    params: { query },
  });
  return response.data.results;
};

export const getDetails = async (type: 'movie' | 'tv', id: number): Promise<MediaDetails> => {
  const response = await tmdb.get(`/${type}/${id}`, {
    params: { append_to_response: 'videos,credits,similar' }
  });
  return { ...response.data, media_type: type };
};

export const getVideos = async (type: 'movie' | 'tv', id: number): Promise<Video[]> => {
  const response = await tmdb.get(`/${type}/${id}/videos`);
  return response.data.results;
};

export const getImageUrl = (path: string | null, size: 'w500' | 'original' = 'w500') => {
  if (!path) return 'https://via.placeholder.com/500x750?text=No+Image';
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const getMoviesByCategory = async (category: 'popular' | 'top_rated' | 'now_playing' | 'upcoming'): Promise<Media[]> => {
  const response = await tmdb.get(`/movie/${category}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.data.results.map((item: any) => ({ ...item, media_type: 'movie' }));
};

export const getTVShowsByCategory = async (category: 'popular' | 'top_rated' | 'on_the_air'): Promise<Media[]> => {
  const response = await tmdb.get(`/tv/${category}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.data.results.map((item: any) => ({ ...item, media_type: 'tv' }));
};

export const getCredits = async (type: 'movie' | 'tv', id: number) => {
  const response = await tmdb.get(`/${type}/${id}/credits`);
  return response.data;
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
  }
): Promise<Media[]> => {
  const response = await tmdb.get(`/discover/${type}`, { params });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.data.results.map((item: any) => ({ ...item, media_type: type }));
};

export const getSimilar = async (type: 'movie' | 'tv', id: number): Promise<Media[]> => {
  const response = await tmdb.get(`/${type}/${id}/similar`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.data.results.map((item: any) => ({ ...item, media_type: type }));
};

export const getSeasonDetails = async (tvId: number, seasonNumber: number) => {
  const response = await tmdb.get(`/tv/${tvId}/season/${seasonNumber}`);
  return response.data;
};
