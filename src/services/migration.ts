import { db } from '../db';
import { errorAgent } from './errorAgent';

/**
 * Migrates any string-based numeric IDs in the database to proper number types.
 * This fixes issues where items saved as "123" (string) cannot be found when querying for 123 (number).
 */
export async function migrateDatabaseIds() {
  try {
    if (!db.isOpen()) {
      await db.open().catch(err => {
        errorAgent.log({ message: '[Migration] Database failed to open during check', type: 'ERROR', context: { error: String(err) } });
        throw err;
      });
    }

    // console.log('[Migration] Starting ID migration...');
    
    // 1. Migrate Library (formerly Watchlist)
    const watchlistItems = await db.library.toArray();
    let watchlistFixed = 0;
    
    for (const item of watchlistItems) {
      // Check if ID is a string that looks like a number
      if (typeof item.id === 'string' && !isNaN(Number(item.id))) {
        const numericId = Number(item.id);
        
        // Remove old entry
        await db.library.delete(item.id);
        
        // Add new entry with numeric ID
        // Ensure we don't overwrite if it somehow already exists (though unlikely for same item)
        const existing = await db.library.get(numericId);
        if (!existing) {
          await db.library.put({
            ...item,
            id: numericId,
            // Also fix nested tmdbId if needed
            ...((item as { tmdbId?: number | string }).tmdbId ? { tmdbId: Number((item as { tmdbId?: number | string }).tmdbId) } : {})
          });
          watchlistFixed++;
        }
      }
    }

    // 2. Migrate History
    const historyItems = await db.history.toArray();
    let historyFixed = 0;

    for (const item of historyItems) {
      if (typeof item.id === 'string' && !isNaN(Number(item.id))) {
        const numericId = Number(item.id);
        
        await db.history.delete(item.id);
        
        const existing = await db.history.get(numericId);
        if (!existing) {
          await db.history.put({
            ...item,
            id: numericId
          });
          historyFixed++;
        }
      }
    }

    if (watchlistFixed > 0 || historyFixed > 0) {
      // console.log(`[Migration] Completed. Fixed ${watchlistFixed} watchlist items and ${historyFixed} history items.`);
    } else {
      // console.log('[Migration] No string IDs found. Database is clean.');
    }

  } catch (error) {
    errorAgent.log({ message: '[Migration] Failed to migrate database IDs', type: 'ERROR', context: { error: String(error) } });
  }
}
