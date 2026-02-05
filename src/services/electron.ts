// Centralized Electron Service
// Handles all IPC communication between Renderer and Main process

export interface ElectronService {
  // Adblock
  getAdblockPath(): Promise<string>;
  
  // Subtitles
  getSubtitles(videoId: string): Promise<any[]>;
  autoFetchSubtitles(mediaData: any): Promise<any[]>;
  
  // Trailers
  prefetchTrailer(url: string): Promise<void>;
  searchTrailer(query: string): Promise<string | null>;
  
  // IMDB
  searchImdb(query: string): Promise<any[]>;
  getImdbById(id: string): Promise<any>;
  
  // System
  logError(error: any): Promise<void>;
  getLogsPath(): Promise<string>;
  
  // Updates
  checkForUpdates(currentVersion: string): Promise<any>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
}

class ElectronServiceImpl implements ElectronService {
  private get ipc() {
    return window.ipcRenderer;
  }

  private async invoke<T>(channel: string, ...args: any[]): Promise<T> {
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
  async getSubtitles(videoId: string): Promise<any[]> {
    return this.invoke<any[]>('get-subtitles', videoId);
  }

  async autoFetchSubtitles(mediaData: any): Promise<any[]> {
    return this.invoke<any[]>('auto-fetch-subtitles', mediaData);
  }

  // Trailers
  async prefetchTrailer(url: string): Promise<void> {
    return this.invoke<void>('trailer-prefetch', url);
  }

  async searchTrailer(query: string): Promise<string | null> {
    return this.invoke<string | null>('trailer-search', query);
  }

  // IMDB
  async searchImdb(query: string): Promise<any[]> {
    return this.invoke<any[]>('imdb-search', query);
  }

  async getImdbById(id: string): Promise<any> {
    return this.invoke<any>('imdb-get-by-id', id);
  }

  // System
  async logError(error: any): Promise<void> {
    // Fire and forget
    this.ipc?.invoke('log-error', error).catch(() => {});
  }

  async getLogsPath(): Promise<string> {
    return this.invoke<string>('get-logs-path');
  }

  // Updates
  async checkForUpdates(currentVersion: string): Promise<any> {
    return this.invoke<any>('check-for-updates', currentVersion);
  }

  async downloadUpdate(): Promise<void> {
    return this.invoke<void>('download-update');
  }

  async installUpdate(): Promise<void> {
    return this.invoke<void>('install-update');
  }
}

export const electronService = new ElectronServiceImpl();
