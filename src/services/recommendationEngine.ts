import { db, SavedMedia } from '../db';
import { discoverMedia } from './tmdb';
import { Media } from '../types';

// Constants for weighting
const WEIGHTS = {
  HISTORY_FULL: 3,
  HISTORY_PARTIAL: 1,
  LIBRARY: 2,
  LIKE: 5,
  DISLIKE: -5
};

const REC_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 Hours

export const getPreference = async (profileId: number, tmdbId: number) => {
  return db.preferences.where({ profileId, tmdbId }).first();
};

export const togglePreference = async (profileId: number, tmdbId: number, vote: 'like' | 'dislike', mediaType: 'movie' | 'tv' = 'movie') => {
  const existing = await getPreference(profileId, tmdbId);
  if (existing) {
    if (existing.vote === vote) {
      if (existing.id) await db.preferences.delete(existing.id);
    } else {
      if (existing.id) await db.preferences.update(existing.id, { vote, timestamp: Date.now() });
    }
  } else {
    await db.preferences.add({
      profileId,
      tmdbId,
      mediaType,
      vote,
      timestamp: Date.now()
    });
  }
};

/**
 * Calculates a "Taste Profile" for the user based on:
 * 1. Watch History (Genres of watched items)
 * 2. Library (Genres of saved items)
 * 3. Likes/Dislikes (Explicit feedback)
 */
const calculateTasteProfile = async (profileId: number) => {
  const scores: Record<number, number> = {};

  const addScore = (genres: { id: number }[] | undefined, weight: number) => {
    if (!genres) return;
    genres.forEach(g => {
      scores[g.id] = (scores[g.id] || 0) + weight;
    });
  };

  // 1. Fetch Data
  const history = await db.history.orderBy('savedAt').reverse().limit(100).toArray();
  const library = await db.library.toArray();
  const preferences = await db.preferences.where('profileId').equals(profileId).toArray();

  // 2. Process History
  history.forEach(item => {
    let weight = WEIGHTS.HISTORY_FULL;
    if (item.progress && item.progress.percentage < 80) weight = WEIGHTS.HISTORY_PARTIAL;
    addScore(item.genres, weight);
  });

  // 3. Process Library
  library.forEach(item => {
    addScore(item.genres, WEIGHTS.LIBRARY);
  });

  // 4. Process Preferences
  // (We need to fetch genres for these items if not in history/library, 
  // but for performance we might skip if we don't have the media object. 
  // Ideally preferences should store genres or we fetch them.)
  // For this V1, we will skip fetching details for preferences to avoid API spam, 
  // unless we can map them from history/library.
  const knownMedia = new Map<number, SavedMedia>();
  [...history, ...library].forEach(m => knownMedia.set(m.id, m));

  for (const pref of preferences) {
    const media = knownMedia.get(pref.tmdbId);
    if (media) {
      const weight = pref.vote === 'like' ? WEIGHTS.LIKE : WEIGHTS.DISLIKE;
      addScore(media.genres, weight);
    }
  }

  return scores;
};

export const generateDailyMix = async (profileId: number): Promise<Media[]> => {
  // 1. Check Cache
  const cached = await db.recommendationCache.where('profileId').equals(profileId).first();
  if (cached && (Date.now() - cached.generatedAt < REC_CACHE_TTL)) {
    return cached.items;
  }

  // 2. Calculate Taste
  const scores = await calculateTasteProfile(profileId);
  
  // Sort genres by score
  const topGenres = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id]) => id);

  if (topGenres.length === 0) {
    // Fallback for new users
    const trending = await discoverMedia('movie', { sort_by: 'popularity.desc' });
    return trending.slice(0, 20);
  }

  // 3. Discovery Loop
  // Fetch from Top 3 Genres
  const results: Media[] = [];
  const seenIds = new Set<number>();
  
  // Add history IDs to seen to avoid recommending what they watched
  const history = await db.history.limit(100).toArray();
  history.forEach(h => seenIds.add(h.id));

  try {
      const promises = topGenres.map(genreId => 
        discoverMedia('movie', {
            with_genres: genreId,
            sort_by: 'vote_average.desc',
            'vote_count.gte': 500,
            'primary_release_date.gte': '2010-01-01'
        })
      );

      const genreResults = await Promise.all(promises);
      
      // Round Robin selection from results
      for (let i = 0; i < 10; i++) { // Take up to 10 from each
          for (const list of genreResults) {
              if (list[i] && !seenIds.has(list[i].id)) {
                  results.push(list[i]);
                  seenIds.add(list[i].id);
              }
          }
      }
  } catch (e) {
      // console.error("RecEngine Error", e);
  }

  // 4. Cache Results
  const finalMix = results.slice(0, 20);
  
  // Check if cache exists to update or add
  if (cached && cached.id) {
     await db.recommendationCache.update(cached.id, {
        generatedAt: Date.now(),
        items: finalMix as SavedMedia[]
     });
  } else {
     await db.recommendationCache.add({
        profileId,
        generatedAt: Date.now(),
        items: finalMix as SavedMedia[] // Cast for storage compatibility
     });
  }

  return finalMix;
};
