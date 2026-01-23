import Dexie, { Table } from 'dexie';
import { Media } from './types';

export interface SavedMedia extends Media {
  savedAt: number;
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

export interface Profile {
  id?: number;
  userId: number;
  name: string;
  avatarId: string;
  isKid: boolean;
  settings?: {
    autoplay: boolean;
    subtitleSize: 'small' | 'medium' | 'large';
    subtitleColor: 'white' | 'yellow' | 'cyan';
  };
}

class InflucineDB extends Dexie {
  watchlist!: Table<SavedMedia>;
  history!: Table<SavedMedia>;
  users!: Table<User>;
  profiles!: Table<Profile>;

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
  }
}

export const db = new InflucineDB();
