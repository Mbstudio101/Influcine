import { useState, useEffect } from 'react';

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
        
        // Check if exists locally (or just get the stream URL)
        const localUrl = await window.ipcRenderer.invoke('trailer-check', videoId);
        
        if (mounted) {
           if (localUrl) {
             setCachedUrl(localUrl);
           } else {
             // Fallback for safety, though trailer-check should now always return a URL
             setCachedUrl(`trailer://${videoId}`);
           }
        }

        // Trigger background download to upgrade to 1080p local file for next time
        // Add a delay to prioritize immediate playback bandwidth
        setTimeout(() => {
          if (mounted) {
             window.ipcRenderer.invoke('trailer-download', videoId).catch(() => {});
          }
        }, 5000); // Reduced delay to 5s since we aren't streaming via proxy anymore
          
      } catch (error) {
        // console.error('Trailer cache error:', error);
      }
    };

    init();

    return () => { mounted = false; };
  }, [videoId]);

  return cachedUrl;
};
