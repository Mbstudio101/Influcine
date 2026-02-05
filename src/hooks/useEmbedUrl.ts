import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';

export type StreamProvider = 'vidfast' | 'vidlink' | 'vidsrc' | 'superembed' | '2embed';

interface UseEmbedUrlProps {
  type: 'movie' | 'tv';
  id: string;
  season?: number;
  episode?: number;
  startTime?: number;
  autoPlay?: boolean;
  provider?: StreamProvider;
}

export const useEmbedUrl = ({ type, id, season, episode, startTime = 0, autoPlay = true, provider = 'vidfast' }: UseEmbedUrlProps) => {
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

    switch (provider) {
        case 'vidlink':
            if (type === 'movie') {
                url = `https://vidlink.pro/movie/${id}?${params.toString()}`;
            } else if (season && episode) {
                params.append('nextButton', 'true');
                params.append('autoNext', String(autoPlayNext));
                url = `https://vidlink.pro/tv/${id}/${season}/${episode}?${params.toString()}`;
            }
            break;
        case 'vidsrc':
            if (type === 'movie') {
                url = `https://vidsrc.net/embed/movie/${id}`;
            } else if (season && episode) {
                url = `https://vidsrc.net/embed/tv/${id}/${season}/${episode}`;
            }
            break;
        case 'superembed':
            if (type === 'movie') {
                url = `https://multiembed.mov/?video_id=${id}&tmdb=1`;
            } else if (season && episode) {
                url = `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`;
            }
            break;
        case '2embed':
            if (type === 'movie') {
                url = `https://www.2embed.cc/embed/${id}`;
            } else if (season && episode) {
                url = `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`;
            }
            break;
        case 'vidfast':
        default:
            if (type === 'movie') {
                url = `https://vidfast.pro/movie/${id}?${params.toString()}`;
            } else if (season && episode) {
                params.append('nextButton', 'true');
                params.append('autoNext', String(autoPlayNext));
                url = `https://vidfast.pro/tv/${id}/${season}/${episode}?${params.toString()}`;
            }
            break;
    }
    
    return url;
  }, [themeColor, type, id, season, episode, autoPlayNext, startTime, autoPlay, provider]);

  return embedUrl;
};
