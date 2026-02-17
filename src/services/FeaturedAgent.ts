import { Media } from '../types';
import { discoverMedia, getNewOnTopPlatforms, getTrending, searchMulti } from './tmdb';

const HERO_CURATED_TITLES = [
  "Joe's College Trip",
  'Carry-On',
  'The Night Agent',
  'Silo',
  'The Boys',
];

const uniqById = (items: Media[]): Media[] => {
  const seen = new Set<number>();
  const out: Media[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
};

const getReleaseDateTs = (item: Media): number => {
  const raw = item.release_date || item.first_air_date;
  if (!raw) return 0;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
};

const scoreForHero = (item: Media): number => {
  const now = Date.now();
  const releaseTs = getReleaseDateTs(item);
  const ageDays = releaseTs > 0 ? Math.max(0, (now - releaseTs) / (1000 * 60 * 60 * 24)) : 3650;
  const recency = Math.max(0, 1 - ageDays / 365);
  const quality = Math.min(1, (item.vote_average || 0) / 10);
  const popularity = Math.min(1, (item.popularity || 0) / 1000);
  return recency * 0.6 + quality * 0.25 + popularity * 0.15;
};

export const getFeaturedHeroItems = async (watchRegion = 'US', limit = 10): Promise<Media[]> => {
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const oneYearAgoDate = oneYearAgo.toISOString().split('T')[0];

  const curatedResults = await Promise.all(HERO_CURATED_TITLES.map((title) => searchMulti(title)));
  const curatedMatches = curatedResults
    .map((result, idx) => {
      const exact = result.find(
        (item) => (item.title || item.name || '').toLowerCase() === HERO_CURATED_TITLES[idx].toLowerCase()
      );
      return exact || result[0] || null;
    })
    .filter((item): item is Media => !!item);

  const [recentMovies, recentTV, trendingDay, trendingWeek, platformPicks] = await Promise.all([
    discoverMedia('movie', {
      sort_by: 'primary_release_date.desc',
      'primary_release_date.gte': oneYearAgoDate,
      'vote_count.gte': 120,
      'vote_average.gte': 6.5,
    }),
    discoverMedia('tv', {
      sort_by: 'first_air_date.desc',
      'first_air_date.gte': oneYearAgoDate,
      'vote_count.gte': 80,
      'vote_average.gte': 6.5,
    }),
    getTrending('day'),
    getTrending('week'),
    getNewOnTopPlatforms(20, watchRegion),
  ]);

  const combined = uniqById([
    ...curatedMatches,
    ...platformPicks,
    ...recentMovies,
    ...recentTV,
    ...trendingDay,
    ...trendingWeek,
  ]);

  const recentFirst = combined
    .sort((a, b) => {
      const dateDiff = getReleaseDateTs(b) - getReleaseDateTs(a);
      if (dateDiff !== 0) return dateDiff;
      return scoreForHero(b) - scoreForHero(a);
    })
    .slice(0, limit);

  return recentFirst;
};
