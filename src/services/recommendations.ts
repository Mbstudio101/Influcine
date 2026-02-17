import { db } from '../db';
import { discoverMedia, getSimilar, getTrending } from './tmdb';
import { Media } from '../types';
import { generateDailyMix } from './recommendationEngine';

export interface RecommendationResult {
  type: 'core' | 'gem' | 'wildcard' | 'similar';
  title: string;
  items: Media[];
}

type GenreScore = {
  id: number;
  score: number;
};

const getMediaType = (media: Pick<Media, 'media_type' | 'title'>): 'movie' | 'tv' => {
  if (media.media_type) return media.media_type;
  return media.title ? 'movie' : 'tv';
};

const uniqueById = (items: Media[]): Media[] => {
  const seen = new Set<number>();
  const out: Media[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
};

const buildGenreProfile = (history: Media[]): GenreScore[] => {
  const scores = new Map<number, number>();

  history.forEach((item, index) => {
    const genres = (item as Media & { genres?: { id: number }[] }).genres || [];
    if (genres.length === 0) return;

    const completion = (item as Media & { progress?: { percentage?: number } }).progress?.percentage || 0;
    const completionWeight = completion >= 85 ? 1.3 : completion >= 45 ? 1 : 0.65;
    const recencyWeight = Math.max(0.35, 1 - index * 0.02);
    const weight = completionWeight * recencyWeight;

    for (const genre of genres) {
      scores.set(genre.id, (scores.get(genre.id) || 0) + weight);
    }
  });

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
};

const scoreCandidates = (items: Media[], topGenres: GenreScore[]): Media[] => {
  const topGenreWeights = new Map<number, number>(topGenres.map((g) => [g.id, g.score]));
  const now = Date.now();

  const scored = items.map((item) => {
    const release = item.release_date || item.first_air_date;
    const releaseTs = release ? Date.parse(release) : 0;
    const ageDays = releaseTs > 0 ? Math.max(0, (now - releaseTs) / (1000 * 60 * 60 * 24)) : 3650;
    const freshness = Math.max(0, 1 - ageDays / 730);
    const quality = Math.min(1, (item.vote_average || 0) / 10);
    const popularity = Math.min(1, (item.popularity || 0) / 1000);
    const itemGenres = (item as Media & { genre_ids?: number[] }).genre_ids || [];

    let genreAffinity = 0;
    for (const genreId of itemGenres) {
      genreAffinity += topGenreWeights.get(genreId) || 0;
    }
    genreAffinity = Math.min(1.5, genreAffinity / 3);

    const rank = genreAffinity * 0.5 + quality * 0.25 + popularity * 0.15 + freshness * 0.1;
    return { item, rank };
  });

  return scored
    .sort((a, b) => b.rank - a.rank)
    .map(({ item }) => item);
};

export const getPersonalizedRecommendations = async (profileId?: number): Promise<RecommendationResult[]> => {
  const recommendations: RecommendationResult[] = [];

  // 1. Core Recommendation: "Daily Mix" (Powered by Taste Engine)
  if (profileId) {
    const dailyMix = await generateDailyMix(profileId);
    if (dailyMix.length > 0) {
      recommendations.push({
        type: 'core',
        title: 'Your Daily Mix',
        items: dailyMix
      });
    }
  }

  // 2. Legacy Fallback / Additional Sections
  // Analyze User DNA from History (Global fallback if no profile specific or for additional context)
  const history = await db.history.orderBy('savedAt').reverse().limit(50).toArray();
  const watchedIds = new Set(history.map(h => h.id));
  const genreProfile = buildGenreProfile(history as unknown as Media[]);
  const topGenres = genreProfile.slice(0, 3);
  const preferredType = (() => {
    const movieCount = history.filter((h) => getMediaType(h) === 'movie').length;
    const tvCount = history.length - movieCount;
    if (tvCount > movieCount + 3) return 'tv' as const;
    return 'movie' as const;
  })();
  
  if (history.length === 0 && recommendations.length === 0) {
    // Fallback for completely new users
    const trending = await getTrending('day');
    return [{
      type: 'core',
      title: 'Top Trending (Start Watching to Personalize)',
      items: trending.slice(0, 10)
    }];
  }

  // 3. "Because you watched..." (Similar to Last Watched)
  const last3 = history.slice(0, 3);
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

  const topGenreIds = topGenres.map((g) => g.id);
  const discoverType = preferredType;
  const secondaryType: 'movie' | 'tv' = discoverType === 'movie' ? 'tv' : 'movie';
  const now = new Date();
  const lastYear = new Date(now);
  lastYear.setFullYear(now.getFullYear() - 1);
  const lastYearDate = lastYear.toISOString().split('T')[0];

  const [genreDriven, recentForYou, gems, wildcardRaw] = await Promise.all([
    topGenreIds.length > 0
      ? discoverMedia(discoverType, {
          with_genres: topGenreIds.join(','),
          sort_by: 'popularity.desc',
          'vote_average.gte': 6.7,
          'vote_count.gte': 120,
        })
      : discoverMedia(discoverType, { sort_by: 'popularity.desc', 'vote_average.gte': 6.7, 'vote_count.gte': 120 }),
    topGenreIds.length > 0
      ? discoverMedia(discoverType, {
          with_genres: topGenreIds.join(','),
          sort_by: discoverType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
          'primary_release_date.gte': discoverType === 'movie' ? lastYearDate : undefined,
          'first_air_date.gte': discoverType === 'tv' ? lastYearDate : undefined,
          'vote_count.gte': 80,
        })
      : discoverMedia(discoverType, {
          sort_by: discoverType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
          'vote_count.gte': 80,
        }),
    discoverMedia(discoverType, {
      with_genres: topGenreIds[0] ? String(topGenreIds[0]) : undefined,
      sort_by: 'vote_average.desc',
      'vote_count.gte': 250,
      'vote_count.lte': 6000,
      'vote_average.gte': 7.5,
    }),
    discoverMedia(secondaryType, {
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.8,
      'vote_count.gte': 120,
    }),
  ]);

  const alreadyRecommended = new Set<number>();
  recommendations.forEach((section) => section.items.forEach((item) => alreadyRecommended.add(item.id)));

  const clean = (items: Media[], max = 10) =>
    uniqueById(items)
      .filter((item) => !watchedIds.has(item.id) && !alreadyRecommended.has(item.id))
      .slice(0, max);

  const rankedForYou = clean(scoreCandidates(genreDriven, topGenres), 12);
  if (rankedForYou.length > 0) {
    recommendations.push({
      type: 'core',
      title: 'Picked for You',
      items: rankedForYou,
    });
    rankedForYou.forEach((item) => alreadyRecommended.add(item.id));
  }

  const freshForYou = clean(scoreCandidates(recentForYou, topGenres), 10);
  if (freshForYou.length > 0) {
    recommendations.push({
      type: 'core',
      title: 'Fresh for You',
      items: freshForYou,
    });
    freshForYou.forEach((item) => alreadyRecommended.add(item.id));
  }

  const filteredGems = clean(scoreCandidates(gems, topGenres), 10);
  if (filteredGems.length > 0) {
    recommendations.push({
      type: 'gem',
      title: 'Hidden Gems You Might Have Missed',
      items: filteredGems,
    });
    filteredGems.forEach((item) => alreadyRecommended.add(item.id));
  }

  const filteredWildcards = clean(scoreCandidates(wildcardRaw, topGenres), 10);
  if (filteredWildcards.length > 0) {
    recommendations.push({
      type: 'wildcard',
      title: discoverType === 'movie' ? 'Binge-Worthy TV for You' : 'Movies You Will Likely Enjoy',
      items: filteredWildcards,
    });
  }

  return recommendations;
};
