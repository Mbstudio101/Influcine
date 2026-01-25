export interface Media {
  id: number;
  title?: string;
  name?: string; // TV shows have 'name' instead of 'title'
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string; // TV shows
  media_type: 'movie' | 'tv';
  popularity?: number;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface MediaDetails extends Media {
  genres: { id: number; name: string }[];
  runtime?: number;
  number_of_seasons?: number;
  seasons?: Season[];
  next_episode_to_air?: {
    id: number;
    name: string;
    overview: string;
    air_date: string;
    episode_number: number;
    season_number: number;
    still_path: string | null;
  };
  videos?: {
    results: Video[];
  };
}

export interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  poster_path: string | null;
}

export interface SearchResult {
  page: number;
  results: Media[];
  total_pages: number;
  total_results: number;
}
