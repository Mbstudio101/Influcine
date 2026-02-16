import { useState, useEffect } from 'react';
import { errorAgent } from '../services/errorAgent';

const failedTrailerDownloads = new Map<string, number>();
const warnedTrailerDownloads = new Set<string>();
const DOWNLOAD_RETRY_COOLDOWN_MS = 1000 * 60 * 30; // 30 min

export const useTrailerCache = (videoId: string | undefined) => {
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) {
        setCachedUrl(null);
        return;
    }

    let mounted = true;

    const init = async () => {
      try {
        // Strategy: Always return 'trailer://' protocol URL to allow immediate streaming.
        // The backend protocol handler will decide whether to serve from disk or stream from YouTube.
        // This ensures the UI always gets a valid video source for the <video> tag.

        const ipc = window.ipcRenderer;
        if (!ipc) {
          if (mounted) setCachedUrl(`trailer://v/${videoId}`);
          return;
        }

        // Check if exists locally (or just get the stream URL)
        const localUrl = await ipc.invoke('trailer-check', videoId);
        
        if (mounted) {
           if (localUrl) {
            setCachedUrl(localUrl);
          } else {
            // Fallback for safety, though trailer-check should now always return a URL
            // We use trailer://v/ID format to preserve case-sensitivity of YouTube IDs
            setCachedUrl(`trailer://v/${videoId}`);
          }
        }

        const lastFailureTs = failedTrailerDownloads.get(videoId) || 0;
        const shouldSkipRetry = Date.now() - lastFailureTs < DOWNLOAD_RETRY_COOLDOWN_MS;
        if (shouldSkipRetry) return;

        // Trigger background download to upgrade to 1080p local file for next time
        // Add a delay to prioritize immediate playback bandwidth
        setTimeout(() => {
          if (mounted) {
             ipc.invoke('trailer-download', videoId).catch((e) => {
               failedTrailerDownloads.set(videoId, Date.now());
               if (!warnedTrailerDownloads.has(videoId)) {
                 warnedTrailerDownloads.add(videoId);
                 errorAgent.log({ message: 'Background trailer download failed', type: 'WARN', context: { videoId, error: String(e) } });
               }
             });
          }
        }, 5000); // Reduced delay to 5s since we aren't streaming via proxy anymore
          
      } catch (error) {
        errorAgent.log({ message: 'Trailer cache error', type: 'ERROR', context: { videoId, error: String(error) } });
      }
    };

    init();

    return () => { mounted = false; };
  }, [videoId]);

  return cachedUrl;
};
