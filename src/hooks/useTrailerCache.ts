import { useState, useEffect } from 'react';
import { errorAgent } from '../services/errorAgent';

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

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
        if (!isTauri) {
          if (mounted) setCachedUrl(null);
          return;
        }

        const { invoke } = await import('@tauri-apps/api/core');
        const localUrl = await invoke<string | null>('trailer_check', { videoId });

        if (mounted) {
          setCachedUrl(localUrl || `asset://localhost/trailers/${videoId}.mp4`);
        }
      } catch (error) {
        errorAgent.log({ message: 'Trailer cache error', type: 'ERROR', context: { videoId, error: String(error) } });
      }
    };

    init();

    return () => { mounted = false; };
  }, [videoId]);

  return cachedUrl;
};
