import { Video } from '../types';

export const findBestTrailer = (videos: Video[] | undefined): Video | undefined => {
  if (!videos || videos.length === 0) return undefined;

  // Priority list for trailer types
  // 'Opening Credits' is often relevant for Anime if no trailer exists
  const typePriority = ['Trailer', 'Teaser', 'Opening Credits', 'Clip', 'Featurette'];
  
  // Filter for YouTube videos only first (as we only support YouTube embedding currently)
  const youtubeVideos = videos.filter(v => v.site === 'YouTube');
  
  if (youtubeVideos.length === 0) return undefined;

  // 1. Try to find by type priority
  for (const type of typePriority) {
    const match = youtubeVideos.find(v => v.type === type);
    if (match) return match;
  }

  // 2. Fallback to the first YouTube video if no specific type matches
  return youtubeVideos[0];
};
