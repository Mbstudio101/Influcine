import Dexie, { Table } from 'dexie';
import { Media } from './types';

export interface SavedMedia extends Media {
  savedAt: number;
  tmdbId?: number;
  genres?: { id: number; name: string }[];
  progress?: {
    watched: number; // Seconds watched
    duration: number; // Total duration in seconds
    percentage: number; // 0-100
    lastUpdated: number;
    season?: number;
    episode?: number;
  };
}

export interface User {
  id?: number;
  email: string;
  passwordHash: string;
  createdAt: number;
}

export interface Achievement {
  id?: number; // Auto-increment
  profileId: number;
  achievementId: string;
  tier: number; // 1=I, 2=II, 3=III, 4=Master
  unlockedAt: number;
  progress: number;
  isUnlocked: boolean;
}

export interface SourceMemory {
  id?: number;
  tmdbId: number;
  season?: number;
  episode?: number;
  provider: string;
  url: string;
  successRate: number; // 0-100
  lastSuccess: number;
  lastFailure?: number;
  isVerified: boolean;
}

export interface Profile {
  id?: number;
  userId: number;
  name: string;
  avatarId: string;
  isKid: boolean;
  stats?: {
    totalXP: number;
    level: number;
    streak: number;
    lastWatchDate: number; // timestamp
    hoursWatched: number;
    moviesWatched: number;
    seriesWatched: number;
  };
  settings?: {
    autoplay: boolean;
    subtitleSize: 'small' | 'medium' | 'large';
    subtitleColor: 'white' | 'yellow' | 'cyan';
  };
}

export interface Reminder {
  id?: number;
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  releaseDate: string; // ISO date string
  posterPath?: string;
  remindAt: number; // Timestamp for notification
}

export interface CachedRelease {
  id?: number;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  releaseDate: string;
  posterPath?: string;
  fetchedAt: number;
}

class InflucineDB extends Dexie {
  watchlist!: Table<SavedMedia>;
  history!: Table<SavedMedia>;
  users!: Table<User>;
  profiles!: Table<Profile>;
  achievements!: Table<Achievement>;
  sourceMemory!: Table<SourceMemory>;
  reminders!: Table<Reminder>;
  cachedReleases!: Table<CachedRelease>;
  queryCache!: Table<QueryCache>;
  episodeProgress!: Table<EpisodeProgress>;

  constructor() {
    super('InflucineDB');
    this.version(1).stores({
      watchlist: 'id, title, name, savedAt',
      history: 'id, title, name, savedAt, [savedAt]'
    });
    
    this.version(2).stores({
      watchlist: 'id, title, name, savedAt',
      history: 'id, title, name, savedAt, [savedAt]',
      users: '++id, &email',
      profiles: '++id, userId, [userId]'
    });

    this.version(3).stores({
      achievements: '++id, profileId, achievementId, [profileId+achievementId]',
      sourceMemory: '++id, tmdbId, [tmdbId+season+episode]',
      profiles: '++id, userId, [userId]'
    });

    this.version(4).stores({
      reminders: '++id, mediaId, releaseDate, [mediaId+mediaType]',
      cachedReleases: '++id, tmdbId, releaseDate, [tmdbId+mediaType]'
    });

    this.version(5).stores({
      queryCache: '++id, query, normalizedQuery, timestamp'
    });

    this.version(6).stores({
      episodeProgress: '++id, profileId, showId, season, episode, [profileId+showId+season+episode], [profileId+showId]'
    });
  }
}

export interface QueryCache {
  id?: number;
  query: string;
  normalizedQuery: string;
  results: Media[];
  timestamp: number;
  hitCount: number;
}

export const db = new InflucineDB();

export interface EpisodeProgress {
  id?: number;
  profileId: number;
  showId: number;
  season: number;
  episode: number;
  watchedSeconds: number;
  durationSeconds: number;
  percentage: number;
  lastUpdated: number;
}
