import { Subtitle, AutoSubtitle, ImdbResult, ImdbDetails, UpdateCheckResult } from '../types';
import { invoke } from '@tauri-apps/api/core';

export interface ElectronService {
  getAdblockPath(): Promise<string>;
  getSubtitles(videoId: string): Promise<Subtitle[]>;
  autoFetchSubtitles(mediaData: unknown): Promise<AutoSubtitle[]>;
  prefetchTrailer(url: string): Promise<void>;
  searchTrailer(query: string): Promise<string | null>;
  searchImdb(query: string): Promise<ImdbResult[]>;
  getImdbById(id: string): Promise<ImdbDetails>;
  getActorImage(name: string): Promise<string | null>;
  logError(error: unknown): Promise<void>;
  getLogsPath(): Promise<string>;
  checkForUpdates(currentVersion: string): Promise<UpdateCheckResult>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
}

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

class TauriServiceImpl implements ElectronService {
  private async cmd<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    if (!isTauri) {
      return Promise.reject(new Error('Tauri API not available'));
    }
    return invoke<T>(command, args);
  }

  async getAdblockPath(): Promise<string> {
    return this.cmd<string>('get_adblock_script');
  }

  async getSubtitles(videoId: string): Promise<Subtitle[]> {
    return this.cmd<Subtitle[]>('get_subtitles', { videoId });
  }

  async autoFetchSubtitles(mediaData: unknown): Promise<AutoSubtitle[]> {
    return this.cmd<AutoSubtitle[]>('auto_fetch_subtitles', { request: mediaData });
  }

  async prefetchTrailer(videoId: string): Promise<void> {
    await this.cmd<boolean>('trailer_prefetch', { videoId });
  }

  async searchTrailer(query: string): Promise<string | null> {
    return this.cmd<string | null>('trailer_search', { query });
  }

  async searchImdb(query: string): Promise<ImdbResult[]> {
    const result = await this.cmd<{ results: ImdbResult[]; error?: string }>('imdb_search', { query });
    return result.results;
  }

  async getImdbById(_id: string): Promise<ImdbDetails> {
    return Promise.reject(new Error('Not implemented'));
  }

  async getActorImage(name: string): Promise<string | null> {
    return this.cmd<string | null>('get_actor_image', { name });
  }

  async logError(error: unknown): Promise<void> {
    try {
      await this.cmd('log_error', { errorData: error });
    } catch (e) {
      console.warn('[TauriService] Failed to send error log:', e);
    }
  }

  async getLogsPath(): Promise<string> {
    return this.cmd<string>('get_logs_path');
  }

  async checkForUpdates(currentVersion: string): Promise<UpdateCheckResult> {
    return this.cmd<UpdateCheckResult>('update_check', { currentVersion });
  }

  async downloadUpdate(): Promise<void> {
    throw new Error('Use GitHub release downloads in Tauri');
  }

  async installUpdate(): Promise<void> {
    throw new Error('Use GitHub release downloads in Tauri');
  }
}

export const electronService = new TauriServiceImpl();
