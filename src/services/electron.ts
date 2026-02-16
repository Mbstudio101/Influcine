import { Subtitle, AutoSubtitle, ImdbResult, ImdbDetails, UpdateCheckResult } from '../types';

// Centralized Electron Service
// Handles all IPC communication between Renderer and Main process

export interface ElectronService {
  // Adblock
  getAdblockPath(): Promise<string>;
  
  // Subtitles
  getSubtitles(videoId: string): Promise<Subtitle[]>;
  autoFetchSubtitles(mediaData: unknown): Promise<AutoSubtitle[]>;
  
  // Trailers
  prefetchTrailer(url: string): Promise<void>;
  searchTrailer(query: string): Promise<string | null>;
  
  // IMDB
  searchImdb(query: string): Promise<ImdbResult[]>;
  getImdbById(id: string): Promise<ImdbDetails>;

  // Scraper
  getActorImage(name: string): Promise<string | null>;
  
  // System
  logError(error: unknown): Promise<void>;
  getLogsPath(): Promise<string>;
  
  // Updates
  checkForUpdates(currentVersion: string): Promise<UpdateCheckResult>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
}

class ElectronServiceImpl implements ElectronService {
  private get ipc() {
    return typeof window !== 'undefined' ? window.ipcRenderer : undefined;
  }

  private async invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    if (!this.ipc) {
      if (import.meta.env.DEV) {
        console.warn(`[ElectronService] IPC not available. Call to '${channel}' ignored.`);
      }
      return Promise.reject(new Error('Electron IPC not available'));
    }
    return this.ipc.invoke(channel, ...args);
  }

  // Adblock
  async getAdblockPath(): Promise<string> {
    return this.invoke<string>('get-adblock-path');
  }

  // Subtitles
  async getSubtitles(videoId: string): Promise<Subtitle[]> {
    return this.invoke<Subtitle[]>('get-subtitles', videoId);
  }

  async autoFetchSubtitles(mediaData: unknown): Promise<AutoSubtitle[]> {
    return this.invoke<AutoSubtitle[]>('auto-fetch-subtitles', mediaData);
  }

  // Trailers
  async prefetchTrailer(url: string): Promise<void> {
    return this.invoke<void>('trailer-prefetch', url);
  }

  async searchTrailer(query: string): Promise<string | null> {
    return this.invoke<string | null>('trailer-search', query);
  }

  // IMDB
  async searchImdb(query: string): Promise<ImdbResult[]> {
    return this.invoke<ImdbResult[]>('imdb-search', query);
  }

  async getImdbById(id: string): Promise<ImdbDetails> {
    return this.invoke<ImdbDetails>('imdb-get-by-id', id);
  }

  // Scraper
  async getActorImage(name: string): Promise<string | null> {
    return this.invoke<string | null>('get-actor-image', name);
  }

  // System
  async logError(error: unknown): Promise<void> {
    // Fire and forget — if error logging itself fails, write to console as last resort
    this.ipc?.invoke('log-error', error).catch((e) => {
      console.warn('[ElectronService] Failed to send error log to main process:', e);
    });
  }

  async getLogsPath(): Promise<string> {
    return this.invoke<string>('get-logs-path');
  }

  // Updates
  async checkForUpdates(currentVersion: string): Promise<UpdateCheckResult> {
    return this.invoke<UpdateCheckResult>('check-for-updates', currentVersion);
  }

  async downloadUpdate(): Promise<void> {
    return this.invoke<void>('download-update');
  }

  async installUpdate(): Promise<void> {
    return this.invoke<void>('install-update');
  }
}

export const electronService = new ElectronServiceImpl();
