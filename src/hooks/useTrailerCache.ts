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
        // New Strategy: Use 'trailer://' immediately.
        // The protocol handler now supports:
        // 1. Serving cached file if exists (1080p)
        // 2. Streaming remote URL if missing (720p fallback)
        // This ensures INSTANT playback.
        
        const url = `trailer://${videoId}`;
        if (mounted) setCachedUrl(url);

        // Trigger background download to upgrade to 1080p for next time
        // Add a delay to prioritize immediate playback bandwidth
        setTimeout(() => {
          if (mounted) {
             window.ipcRenderer.invoke('trailer-download', videoId).catch(() => {});
          }
        }, 15000); // 15s delay
          
      } catch (error) {
        // console.error('Trailer cache error:', error);
      }
    };

    init();

    return () => { mounted = false; };
  }, [videoId]);

  return cachedUrl;
};
