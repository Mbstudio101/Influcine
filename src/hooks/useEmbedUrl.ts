import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';

interface UseEmbedUrlProps {
  type: 'movie' | 'tv';
  id: string;
  season?: number;
  episode?: number;
  startTime?: number;
  autoPlay?: boolean;
}

export const useEmbedUrl = ({ type, id, season, episode, startTime = 0, autoPlay = true }: UseEmbedUrlProps) => {
  const { themeColor, autoplay: autoPlayNext } = useSettings();

  const embedUrl = useMemo(() => {
    // Default theme color if undefined
    const safeThemeColor = themeColor || '#7c3aed';
    const theme = safeThemeColor.replace('#', '');
    
    if (!id) {
      return '';
    }

    let url = '';
    const params = new URLSearchParams({
      autoPlay: String(autoPlay),
      theme: theme,
    });

    if (startTime > 0) {
      params.append('startAt', Math.floor(startTime).toString());
    }

    if (type === 'movie') {
      url = `https://vidfast.pro/movie/${id}?${params.toString()}`;
    } else {
      if (season && episode) {
          params.append('nextButton', 'true');
          params.append('autoNext', String(autoPlayNext));
          url = `https://vidfast.pro/tv/${id}/${season}/${episode}?${params.toString()}`;
      }
    }
    
    return url;
  }, [themeColor, type, id, season, episode, autoPlayNext, startTime, autoPlay]);

  return embedUrl;
};
