import { MediaDetails } from '../types';

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

    // console.log('Starting download for:', media.title);

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
    
    // Downloads are disabled for Embed-only mode
    newItem.status = 'failed';
    throw new Error('Downloads are not supported with the current player.');
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
