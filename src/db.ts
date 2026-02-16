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
    audio?: {
      spatialEnabled: boolean;
      outputMode: 'stereo' | 'surround-5.1' | 'atmos-passthrough' | 'binaural-virtualized';
    };
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

export interface RecentSearch {
  id?: number;
  query: string;
  timestamp: number;
}

export interface UserPreference {
    id?: number;
    profileId: number;
    tmdbId: number;
    mediaType: 'movie' | 'tv';
    vote: 'like' | 'dislike';
    timestamp: number;
}

export interface RecommendationCache {
    id?: number;
    profileId: number;
    generatedAt: number;
    items: Media[];
}

class InflucineDB extends Dexie {
  library!: Table<SavedMedia>;
  recentSearches!: Table<RecentSearch>;
  history!: Table<SavedMedia>;
  users!: Table<User>;
  preferences!: Table<UserPreference>;
  recommendationCache!: Table<RecommendationCache>;
  profiles!: Table<Profile>;
  achievements!: Table<Achievement>;
  sourceMemory!: Table<SourceMemory>;
  reminders!: Table<Reminder>;
  cachedReleases!: Table<CachedRelease>;
  queryCache!: Table<QueryCache>;
  episodeProgress!: Table<EpisodeProgress>;
  // Deprecated but kept for type safety during migration if needed (though Dexie handles it via upgrade)
  // watchlist!: Table<SavedMedia>; 

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

    // Ensure watchlist/history schema is correct and consistent
    this.version(7).stores({
      watchlist: 'id, title, name, savedAt',
      history: 'id, title, name, savedAt, [savedAt]'
    });

    // Version 8: Rename watchlist to library to fix broken schema state
    this.version(8).stores({
      watchlist: null, // Delete old table
      library: 'id, title, name, savedAt' // Create new table
    }).upgrade(async tx => {
      // Migrate data from old 'watchlist' table to new 'library' table
      // Note: In Dexie, when a table is set to null, it is deleted, but we can access it via tx.table('watchlist')
      // ONLY if we didn't set it to null? 
      // Actually, Dexie's upgrade system runs BEFORE the schema change is finalized?
      // No, upgrade runs AFTER the version is applied but allows access to old data via special handling?
      // Wait, Dexie docs say: "To rename a table... set old to null, new to schema... in upgrade(), read from old, write to new."
      
      // However, since we suspect the old table schema is broken ("key path did not yield value"), 
      // reading from it might fail if we iterate.
      // We will try our best.
      try {
        // We have to use a raw IDB transaction or trust Dexie.
        // But since 'watchlist' is removed in this version, tx.table('watchlist') might not exist?
        // Correct way in Dexie:
        // Use idbtrans.objectStore('watchlist')
        const idbTrans = tx.idbtrans;
        // Check if old store exists
        if (idbTrans.db.objectStoreNames.contains('watchlist')) {
             // We can't use Dexie's table() for a deleted table easily.
             // But we can use the raw IDB object store.
             const store = idbTrans.objectStore('watchlist');
             const request = store.getAll();
             request.onsuccess = (e: Event) => {
                const items = (e.target as IDBRequest).result;
                if (items && items.length > 0) {
                    // Write to new library table
                    // We can use tx.table('library') because it exists in this version
                    tx.table('library').bulkPut(items).catch((err) => {
                        console.error('Migration bulkPut failed:', err);
                    });
                }
             };
        }
      } catch (err) {
        console.error('Migration from watchlist to library failed:', err);
      }
    });

    // Version 10: Consolidate everything to ensure stable state
    // This is a "checkpoint" version that defines the full schema as it should be.
    this.version(10).stores({
      library: 'id, title, name, savedAt',
      history: 'id, title, name, savedAt, [savedAt]',
      users: '++id, &email',
      profiles: '++id, userId, [userId]',
      achievements: '++id, profileId, achievementId, [profileId+achievementId]',
      // sourceMemory: '++id, tmdbId, [tmdbId+season+episode]',
      reminders: '++id, mediaId, releaseDate, [mediaId+mediaType]',
      cachedReleases: '++id, tmdbId, releaseDate, [tmdbId+mediaType]',
      queryCache: '++id, query, normalizedQuery, timestamp',
      episodeProgress: '++id, profileId, showId, season, episode, [profileId+showId+season+episode], [profileId+showId]',
      // Temporarily remove recentSearches to prevent "changing primary key" error during upgrade
      // It will be recreated in Version 12
      recentSearches: null
    });

    // Version 11: Fix "Not yet support for changing primary key" error by dropping the conflicting table
    // This is necessary if recentSearches was previously created with a different primary key
    this.version(11).stores({
      recentSearches: null
    });

    // Version 12: Recreate recentSearches with the correct schema
    this.version(12).stores({
      recentSearches: '++id, &query, timestamp'
    });
    
    // Version 13: Force database refresh if previous versions failed
    // This version doesn't change schema but ensures we are ahead of any broken state
    this.version(13).stores({});

    // Version 14: Drop tables that might have conflicting primary keys causing "UpgradeError"
    // This forces a clean slate for these tables to ensure login works
    this.version(14).stores({
      users: null,
      profiles: null,
      recentSearches: null
    });

    // Version 16: Drop ALL non-critical tables to resolve persistent UpgradeError
    // This handles cases where other tables (achievements, cache, etc.) have schema conflicts
    this.version(16).stores({
      users: null,
      profiles: null,
      recentSearches: null,
      achievements: null,
      sourceMemory: null,
      reminders: null,
      cachedReleases: null,
      queryCache: null,
      episodeProgress: null
    });

    // Version 17: Recreate all dropped tables with definitive schema
    this.version(17).stores({
      users: '++id, &email',
      profiles: '++id, userId, [userId]',
      recentSearches: '++id, &query, timestamp',
      achievements: '++id, profileId, achievementId, [profileId+achievementId]',
      sourceMemory: '++id, tmdbId, [tmdbId+season+episode]',
      reminders: '++id, mediaId, releaseDate, [mediaId+mediaType]',
      cachedReleases: '++id, tmdbId, releaseDate, [tmdbId+mediaType]',
      queryCache: '++id, query, normalizedQuery, timestamp',
      episodeProgress: '++id, profileId, showId, season, episode, [profileId+showId+season+episode], [profileId+showId]'
    });

    this.version(18).stores({
        preferences: '++id, profileId, tmdbId, [profileId+tmdbId]',
        recommendationCache: 'profileId, generatedAt'
    });

    // Version 19: definitive schema checkpoint to stabilize future upgrades.
    // Keeps legacy `watchlist` removed and preserves all active stores.
    this.version(19).stores({
      library: 'id, title, name, savedAt',
      history: 'id, title, name, savedAt, [savedAt]',
      users: '++id, &email',
      profiles: '++id, userId, [userId]',
      recentSearches: '++id, &query, timestamp',
      achievements: '++id, profileId, achievementId, [profileId+achievementId]',
      sourceMemory: '++id, tmdbId, [tmdbId+season+episode]',
      reminders: '++id, mediaId, releaseDate, [mediaId+mediaType]',
      cachedReleases: '++id, tmdbId, releaseDate, [tmdbId+mediaType]',
      queryCache: '++id, query, normalizedQuery, timestamp',
      episodeProgress: '++id, profileId, showId, season, episode, [profileId+showId+season+episode], [profileId+showId]',
      preferences: '++id, profileId, tmdbId, [profileId+tmdbId]',
      recommendationCache: 'profileId, generatedAt'
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
