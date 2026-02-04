import { db, QueryCache } from '../db';
import { searchMulti } from './tmdb';
import { searchLocalIMDB } from './imdb-local';
import { Media } from '../types';
import { normalizeString } from '../utils/stringUtils';

interface AgentSearchResult {
  results: Media[];
  source: 'cache' | 'api';
  confidence: number;
  query: string;
}

const CACHE_TTL = 24 * 60 * 60 * 1000;

export class VideoAgentService {
  /**
   * Main entry point for the agent.
   * Analyzes query, checks cache (exact & fuzzy), fetches if needed, and caches results.
   */
  async search(userQuery: string): Promise<AgentSearchResult> {
    const normalizedQuery = normalizeString(userQuery);
    const now = Date.now();

    // 1. Exact Cache Match
    try {
      const exactMatch = await db.queryCache
        .where('normalizedQuery')
        .equals(normalizedQuery)
        .first();

      if (exactMatch && (now - exactMatch.timestamp < CACHE_TTL)) {
        await this.updateHitCount(exactMatch);
        return {
          results: exactMatch.results,
          source: 'cache',
          confidence: 1.0,
          query: userQuery
        };
      }
    } catch {
      // console.warn('VideoAgent: Cache lookup failed, proceeding to fetch', cacheError);
    }

    // 2. Fetch from External Sources (TMDB + Local IMDB)
    try {
      if (import.meta.env.DEV) {
        // console.log(`VideoAgent: Fetching fresh content for "${userQuery}"`);
      }
      
      const [tmdbResults, localImdbResults] = await Promise.all([
        searchMulti(userQuery).catch(() => {
          if (import.meta.env.DEV) {
            // console.error('TMDB Search failed', e);
          }
          return [] as Media[];
        }),
        searchLocalIMDB(userQuery).catch(() => {
          if (import.meta.env.DEV) {
            // console.warn('Local IMDB Search failed', e);
          }
          return [];
        })
      ]);

      // Convert Local IMDB results to Media objects
      const localMedia: Media[] = localImdbResults.map(item => ({
        id: 0, // Placeholder
        imdb_id: item.tconst,
        title: item.primaryTitle,
        name: item.primaryTitle,
        poster_path: null,
        backdrop_path: null,
        overview: `(Local Database) Released: ${item.startYear || 'N/A'}. Rating: ${item.averageRating || 'N/A'}/10.`,
        vote_average: item.averageRating || 0,
        release_date: item.startYear ? `${item.startYear}-01-01` : undefined,
        first_air_date: item.startYear ? `${item.startYear}-01-01` : undefined,
        media_type: item.titleType === 'tvSeries' ? 'tv' : 'movie',
        popularity: item.numVotes || 0
      }));

      // Merge results
      const results = [...tmdbResults];
      
      for (const local of localMedia) {
        const isDuplicate = results.some(tmdb => {
          const tmdbTitle = (tmdb.title || tmdb.name || '').toLowerCase();
          const localTitle = (local.title || local.name || '').toLowerCase();
          const tmdbYear = (tmdb.release_date || tmdb.first_air_date || '').substring(0, 4);
          const localYear = (local.release_date || '').substring(0, 4);
          
          return tmdbTitle === localTitle && (Math.abs(parseInt(tmdbYear) - parseInt(localYear)) <= 1);
        });
        
        if (!isDuplicate) {
          results.push(local);
        }
      }

      // Sort by popularity
      results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      
      // 4. Cache the new results
      // Filter out people/irrelevant stuff if needed, but searchMulti returns mixed
      // We store it all for now
      
      try {
        await db.queryCache.add({
          query: userQuery,
          normalizedQuery,
          results,
          timestamp: now,
          hitCount: 1
        });

        // Cleanup old cache asynchronously
        this.cleanupCache();
      } catch {
        // console.warn('VideoAgent: Failed to cache results, but search succeeded', cacheWriteError);
      }

      return {
        results,
        source: 'api',
        confidence: 1.0,
        query: userQuery
      };

    } catch {
      // console.error('VideoAgent: Search failed', error);
      // Return empty or fallback
      return {
        results: [],
        source: 'api',
        confidence: 0,
        query: userQuery
      };
    }
  }

  private async updateHitCount(entry: QueryCache) {
    if (entry.id) {
      await db.queryCache.update(entry.id, {
        hitCount: (entry.hitCount || 0) + 1
      });
    }
  }

  private async cleanupCache() {
    const now = Date.now();
    // Delete entries older than TTL
    await db.queryCache
      .where('timestamp')
      .below(now - CACHE_TTL)
      .delete();
      
    // Optional: Limit total cache size to e.g. 500 queries
    const count = await db.queryCache.count();
    if (count > 500) {
      // Delete oldest, least used
      // Dexie doesn't support complex sorting easily for delete, so we do a simple timestamp check
      // or just leave it for now. The TTL is the main cleanup.
    }
  }

  /**
   * Helper to verify if a specific media item has a known working source
   */
  // async getVerifiedSource(tmdbId: number, season?: number, episode?: number) {
  //   return null;
  // }
}

export const VideoAgent = new VideoAgentService();
