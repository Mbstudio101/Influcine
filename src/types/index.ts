export interface Media {
  id: number;
  imdb_id?: string;
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
  audio_format?: 'atmos' | '5.1' | 'stereo'; // Atmos Support
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

export interface AppVersion {
  latest: string;
  forceUpdate: boolean;
  releaseNotes: string;
  platforms: {
    macos?: string;
    windows?: string;
    androidtv?: string;
    linux?: string;
    [key: string]: string | undefined;
  };
}

export interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  runtime?: number;
  air_date?: string;
  vote_average?: number;
}

export interface StreamSource {
  url: string;
  quality: '4k' | '1080p' | '720p' | '480p' | '360p' | 'auto';
  format: 'mp4' | 'm3u8' | 'webm';
  subtitles?: {
    lang: string;
    url: string;
    label: string;
  }[];
  headers?: Record<string, string>;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface Credits {
  id: number;
  cast: CastMember[];
  crew: CrewMember[];
}
