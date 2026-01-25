import { db, QueryCache } from '../db';
import { searchMulti } from './tmdb';
import { Media } from '../types';
import { calculateSimilarity, normalizeString } from '../utils/stringUtils';

interface AgentSearchResult {
  results: Media[];
  source: 'cache' | 'api';
  confidence: number;
  query: string;
  cachedQuery?: string; // If fuzzy matched
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const FUZZY_THRESHOLD = 0.85;

export class VideoAgentService {
  /**
   * Main entry point for the agent.
   * Analyzes query, checks cache (exact & fuzzy), fetches if needed, and caches results.
   */
  async search(userQuery: string): Promise<AgentSearchResult> {
    const normalizedQuery = normalizeString(userQuery);
    const now = Date.now();

    // 1. Exact Cache Match
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

    // 2. Fuzzy/Intelligent Match
    // Fetch all cached queries (this might be heavy if cache is huge, but fine for < 1000 items)
    // For production, we'd limit this or use a proper search index
    const recentCache = await db.queryCache
      .where('timestamp')
      .above(now - CACHE_TTL)
      .toArray();

    let bestMatch: QueryCache | null = null;
    let highestSimilarity = 0;

    for (const cached of recentCache) {
      const similarity = calculateSimilarity(normalizedQuery, cached.normalizedQuery);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = cached;
      }
    }

    if (bestMatch && highestSimilarity >= FUZZY_THRESHOLD) {
      await this.updateHitCount(bestMatch);
      return {
        results: bestMatch.results,
        source: 'cache',
        confidence: highestSimilarity,
        query: userQuery,
        cachedQuery: bestMatch.query
      };
    }

    // 3. Fetch from External Sources (TMDB for now, expandable)
    try {
      console.log(`VideoAgent: Fetching fresh content for "${userQuery}"`);
      const results = await searchMulti(userQuery);
      
      // 4. Cache the new results
      // Filter out people/irrelevant stuff if needed, but searchMulti returns mixed
      // We store it all for now
      
      await db.queryCache.add({
        query: userQuery,
        normalizedQuery,
        results,
        timestamp: now,
        hitCount: 1
      });

      // Cleanup old cache asynchronously
      this.cleanupCache();

      return {
        results,
        source: 'api',
        confidence: 1.0,
        query: userQuery
      };

    } catch (error) {
      console.error('VideoAgent: Search failed', error);
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
  async getVerifiedSource(tmdbId: number, season?: number, episode?: number) {
    return db.sourceMemory
      .where('[tmdbId+season+episode]')
      .equals([tmdbId, season || 0, episode || 0])
      .filter(s => s.isVerified)
      .sortBy('successRate')
      .then(sources => sources[0]?.url);
  }
}

export const VideoAgent = new VideoAgentService();
