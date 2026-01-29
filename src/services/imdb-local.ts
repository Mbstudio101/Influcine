export interface IMDBMovie {
  tconst: string;
  primaryTitle: string;
  startYear: number;
  titleType: string;
  averageRating: number;
  numVotes: number;
}

export const searchLocalIMDB = async (query: string): Promise<IMDBMovie[]> => {
  if (!window.ipcRenderer) {
    console.warn('IPC Renderer not available');
    return [];
  }
  try {
    const response = await window.ipcRenderer.invoke('imdb-search', { query });
    if (response.error) {
      console.error('IMDB Search Error:', response.error);
      return [];
    }
    return response.results || [];
  } catch (err) {
    console.error('Failed to search local IMDB:', err);
    return [];
  }
};
