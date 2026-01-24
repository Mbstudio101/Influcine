import { db, SourceMemory } from '../db';

export const getBestSource = async (tmdbId: number, season?: number, episode?: number): Promise<SourceMemory | null> => {
  // Find verified sources first, sorted by success rate
  const sources = await db.sourceMemory
    .where('[tmdbId+season+episode]')
    .equals([tmdbId, season || 0, episode || 0])
    .filter(s => s.isVerified)
    .reverse()
    .sortBy('successRate');

  return sources[0] || null;
};

export const recordSourceSuccess = async (tmdbId: number, provider: string, url: string, season?: number, episode?: number) => {
  const existing = await db.sourceMemory
    .where('[tmdbId+season+episode]')
    .equals([tmdbId, season || 0, episode || 0])
    .filter(s => s.provider === provider)
    .first();

  if (existing) {
    // Update success rate
    // Simple moving average or just increment
    // Let's just bump it up towards 100
    const newRate = Math.min(100, existing.successRate + 5);
    
    await db.sourceMemory.update(existing.id!, {
      successRate: newRate,
      lastSuccess: Date.now(),
      isVerified: true
    });
  } else {
    await db.sourceMemory.add({
      tmdbId,
      season: season || 0,
      episode: episode || 0,
      provider,
      url,
      successRate: 100, // Initial trust
      lastSuccess: Date.now(),
      isVerified: true
    });
  }
};

export const recordSourceFailure = async (tmdbId: number, provider: string, season?: number, episode?: number) => {
  const existing = await db.sourceMemory
    .where('[tmdbId+season+episode]')
    .equals([tmdbId, season || 0, episode || 0])
    .filter(s => s.provider === provider)
    .first();

  if (existing) {
    const newRate = Math.max(0, existing.successRate - 20);
    await db.sourceMemory.update(existing.id!, {
      successRate: newRate,
      lastFailure: Date.now(),
      isVerified: newRate > 40 // Mark unverified if it drops too low
    });
  }
};
