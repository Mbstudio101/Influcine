import { invoke } from '@tauri-apps/api/core';

export interface IMDBMovie {
  tconst: string;
  primaryTitle: string;
  startYear: number;
  titleType: string;
  averageRating: number;
  numVotes: number;
}

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

export const searchLocalIMDB = async (query: string): Promise<IMDBMovie[]> => {
  if (!isTauri) {
    return [];
  }
  try {
    const response = await invoke<{ results: IMDBMovie[]; error?: string }>('imdb_search', { query });
    if (response.error) {
      console.warn('IMDB Search Error:', response.error);
      return [];
    }
    return response.results || [];
  } catch (err) {
    console.warn('Failed to search local IMDB:', err);
    return [];
  }
};
