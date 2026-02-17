import { useState, useEffect } from 'react';
import { errorAgent } from '../services/errorAgent';

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

        // Background trailer download intentionally disabled.
        // We only use immediate protocol streaming/local check to avoid noisy failures.
      } catch (error) {
        errorAgent.log({ message: 'Trailer cache error', type: 'ERROR', context: { videoId, error: String(error) } });
      }
    };

    init();

    return () => { mounted = false; };
  }, [videoId]);

  return cachedUrl;
};
