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
        // Strategy: Only use 'trailer://' if file exists locally.
        // Otherwise return null to let UI fallback to YouTube Iframe.
        // This ensures users see the official YouTube player (answering "why not from youtube")
        // and avoids flaky yt-dlp streaming.
        
        // Check if exists locally
        const localUrl = await window.ipcRenderer.invoke('trailer-check', videoId);
        
        if (mounted) {
           if (localUrl) {
             setCachedUrl(localUrl);
           } else {
             setCachedUrl(null); // Fallback to Iframe
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
