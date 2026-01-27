import { MediaDetails } from '../types';
import { sourceResolver } from './sourceResolver';

export interface DownloadItem {
  id: string;
  mediaId: number;
  type: 'movie' | 'tv';
  title: string;
  posterPath: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  filePath?: string;
  size?: number;
  addedAt: number;
}

const downloads: DownloadItem[] = [];

export const downloadService = {
  async startDownload(media: MediaDetails, season?: number, episode?: number): Promise<void> {
    const downloadId = media.media_type === 'movie' 
      ? `movie-${media.id}` 
      : `tv-${media.id}-s${season}-e${episode}`;
    
    if (downloads.find(d => d.id === downloadId)) {
      throw new Error('Already downloaded');
    }

    console.log('Starting download for:', media.title);

    const newItem: DownloadItem = {
      id: downloadId,
      mediaId: media.id,
      type: media.media_type,
      title: media.title || media.name || 'Unknown',
      posterPath: media.poster_path || '',
      progress: 0,
      status: 'pending',
      addedAt: Date.now()
    };
    downloads.push(newItem);
    
    try {
      const source = await sourceResolver.resolveSource(media, season, episode);
      
      if (!source) {
        throw new Error('No direct source found for this title');
      }

      newItem.status = 'downloading';
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 5;
        newItem.progress = progress;
        
        if (progress >= 100) {
          clearInterval(interval);
          newItem.status = 'completed';
          newItem.filePath = source.url;
          newItem.size = 15 * 1024 * 1024;
        }
      }, 200);

    } catch (error: unknown) {
      newItem.status = 'failed';
      if (error instanceof Error) {
        throw new Error(error.message || 'Download failed');
      }
      throw new Error('Download failed');
    }
  },

  async getDownloads(): Promise<DownloadItem[]> {
    return downloads;
  },

  async getDownload(id: string): Promise<DownloadItem | undefined> {
    return downloads.find(d => d.id === id);
  },

  async removeDownload(id: string): Promise<void> {
    const index = downloads.findIndex(d => d.id === id);
    if (index !== -1) {
      downloads.splice(index, 1);
    }
  }
};
