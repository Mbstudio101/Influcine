import { db } from '../db';
import { discoverMedia, getSimilar } from './tmdb';
import { Media } from '../types';

export interface RecommendationResult {
  type: 'core' | 'gem' | 'wildcard' | 'similar';
  title: string;
  items: Media[];
}

export const getPersonalizedRecommendations = async (): Promise<RecommendationResult[]> => {
  // 1. Analyze User DNA from History
  const history = await db.history.orderBy('savedAt').reverse().limit(50).toArray();
  
  if (history.length === 0) {
    // Fallback for new users
    const trending = await discoverMedia('movie', { sort_by: 'popularity.desc' });
    return [{
      type: 'core',
      title: 'Top Trending (Start Watching to Personalize)',
      items: trending.slice(0, 10)
    }];
  }

  // Genre Frequency Map
  // const genreCounts: Record<number, number> = {};
  const watchedIds = new Set(history.map(h => h.id));

  // Note: We don't have genre_ids in SavedMedia directly unless we stored them. 
  // Assuming we might not have them, we might need to rely on what we have or fetch details.
  // However, usually Media objects from TMDB have genre_ids. Let's assume they are there.
  // If not, we might need to fetch details for the top watched items.
  // For now, let's try to get recommendations based on the *Last Watched* item if we can't analyze genres easily.
  
  // Strategy: "The Influcine DNA"
  // Since we might not have full genre data stored in indexedDB for every item (depending on how it was saved),
  // we will pivot off the last 3 distinct watched items.

  const last3 = history.slice(0, 3);
  const recommendations: RecommendationResult[] = [];

  // 1. "Because you watched..." (Similar)
  if (last3.length > 0) {
    const lastItem = last3[0];
    const similar = await getSimilar(lastItem.media_type || 'movie', lastItem.id);
    const filteredSimilar = similar.filter(i => !watchedIds.has(i.id)).slice(0, 10);
    
    if (filteredSimilar.length > 0) {
      recommendations.push({
        type: 'similar',
        title: `Because you watched ${lastItem.title || lastItem.name}`,
        items: filteredSimilar
      });
    }
  }

  // 2. "Hidden Gems" (High rated, moderate popularity)
  // We try to guess a genre. If we can't, we pick a random popular genre.
  // Let's assume we can pass a genre from the last item if available. 
  // If not, we do a general "Critically Acclaimed" search.
  
  const gems = await discoverMedia('movie', {
    sort_by: 'vote_average.desc',
    'vote_count.gte': 300,
    'vote_count.lte': 5000,
    'vote_average.gte': 8.0,
    page: 1
  });

  const filteredGems = gems.filter(i => !watchedIds.has(i.id)).slice(0, 10);
  recommendations.push({
    type: 'gem',
    title: 'Hidden Gems You Might Missed',
    items: filteredGems
  });

  // 3. "Wildcard" (Something completely different)
  // Pick a random genre ID (e.g., Documentary=99, History=36, War=10752)
  const discoveryGenres = [99, 36, 10752, 9648, 37]; // Doc, History, War, Mystery, Western
  const randomGenre = discoveryGenres[Math.floor(Math.random() * discoveryGenres.length)];
  
  const wildcards = await discoverMedia('movie', {
    with_genres: randomGenre.toString(),
    sort_by: 'popularity.desc',
    'vote_average.gte': 7.0
  });

  const filteredWildcards = wildcards.filter(i => !watchedIds.has(i.id)).slice(0, 10);
  recommendations.push({
    type: 'wildcard',
    title: 'Explore Something New',
    items: filteredWildcards
  });

  return recommendations;
};
