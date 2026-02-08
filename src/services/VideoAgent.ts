import { db, QueryCache } from '../db';
import { searchMulti } from './tmdb';
import { searchLocalIMDB } from './imdb-local';
import { Media } from '../types';
import { normalizeString } from '../utils/stringUtils';
import { errorAgent } from './errorAgent';

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
    } catch (cacheError) {
      errorAgent.log({ message: 'VideoAgent: Cache lookup failed, proceeding to fetch', type: 'WARN', context: { cacheError } });
    }

    // 2. Fetch from External Sources (TMDB + Local IMDB)
    try {
      if (import.meta.env.DEV) {
        // console.log(`VideoAgent: Fetching fresh content for "${userQuery}"`);
      }
      
      const [tmdbResults, localImdbResults] = await Promise.all([
        searchMulti(userQuery).catch((e) => {
          errorAgent.log({ message: 'TMDB Search failed', type: 'ERROR', context: { error: String(e), query: userQuery } });
          return [] as Media[];
        }),
        searchLocalIMDB(userQuery).catch((e) => {
          errorAgent.log({ message: 'Local IMDB Search failed', type: 'WARN', context: { error: String(e), query: userQuery } });
          return [];
        })
      ]);

      // Convert Local IMDB results to Media objects
      // Use a negative hash derived from tconst to avoid collisions with TMDB IDs
      const localMedia: Media[] = localImdbResults.map(item => ({
        id: -(Math.abs(item.tconst.split('').reduce((acc: number, ch: string) => acc * 31 + ch.charCodeAt(0), 0)) % 1_000_000 || 1),
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
      } catch (cacheWriteError) {
        errorAgent.log({ message: 'VideoAgent: Failed to cache results', type: 'WARN', context: { error: String(cacheWriteError) } });
      }

      return {
        results,
        source: 'api',
        confidence: 1.0,
        query: userQuery
      };

    } catch (error) {
      errorAgent.log({ message: 'VideoAgent: Search failed', type: 'ERROR', context: { error: String(error), query: userQuery } });
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

}

export const VideoAgent = new VideoAgentService();
