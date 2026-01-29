import { db, SavedMedia } from '../db';

export interface CleanupReport {
  libraryRemoved: number;
  historyRemoved: number;
  episodeProgressRemoved: number;
  sourceMemoryRemoved: number;
  errors: string[];
}

export const CleanupAgent = {
  /**
   * Scans the database for items with missing or broken images and removes them.
   * Targets items with no poster_path AND no backdrop_path.
   * Also checks for placeholder URLs if they were accidentally stored.
   * Additionally removes duplicate entries from auxiliary tables.
   */
  async runCleanup(): Promise<CleanupReport> {
    const report: CleanupReport = {
      libraryRemoved: 0,
      historyRemoved: 0,
      episodeProgressRemoved: 0,
      sourceMemoryRemoved: 0,
      errors: []
    };

    try {
      if (!db.isOpen()) {
         // Try to open silently
         await db.open().catch(() => {}); 
         if (!db.isOpen()) return report; // Abort if still closed
      }

      console.log('CleanupAgent: Starting cleanup...');

      // Helper to check if an image path is valid
      const isValidImage = (path: string | null | undefined) => {
        if (!path) return false;
        if (path === '') return false;
        if (path === 'null') return false;
        if (path === 'undefined') return false;
        if (path.includes('via.placeholder.com')) return false;
        return true;
      };

      // Helper to check if item is broken
      // Returns true if item SHOULD be deleted
      const isBrokenItem = (item: SavedMedia) => {
        const hasVisuals = isValidImage(item.poster_path) || isValidImage(item.backdrop_path);
        const hasData = item.title && item.title.trim().length > 0 && item.id;
        
        // Delete if NO visuals OR NO valid data
        return !hasVisuals || !hasData;
      };

      // 1. Clean Library (Watchlist/Favorites)
      const libraryItems = await db.library.toArray();
      const libraryToDelete = libraryItems
        .filter(item => isBrokenItem(item))
        .map(item => item.id);

      if (libraryToDelete.length > 0) {
        // Ensure IDs are defined before deleting
        const validIds = libraryToDelete.filter((id): id is number => typeof id === 'number');
        if (validIds.length > 0) {
          await db.library.bulkDelete(validIds);
          report.libraryRemoved = validIds.length;
          if (import.meta.env.DEV) {
            console.log(`CleanupAgent: Removed ${validIds.length} broken items from Library`);
          }
        }
      }

      // 2. Clean History (Continue Watching)
      const historyItems = await db.history.toArray();
      const historyToDelete = historyItems
        .filter(item => isBrokenItem(item))
        .map(item => item.id);

      if (historyToDelete.length > 0) {
        const validIds = historyToDelete.filter((id): id is number => typeof id === 'number');
        if (validIds.length > 0) {
          await db.history.bulkDelete(validIds);
          report.historyRemoved = validIds.length;
          console.log(`CleanupAgent: Removed ${validIds.length} broken items from History`);
        }
      }

      // 3. Clean Episode Progress (Duplicates)
      // Group by profileId + showId + season + episode
      const progressItems = await db.episodeProgress.toArray();
      const progressToDelete: number[] = [];
      const progressGroups = new Map<string, typeof progressItems>();

      for (const item of progressItems) {
        const key = `${item.profileId}-${item.showId}-${item.season}-${item.episode}`;
        const group = progressGroups.get(key) || [];
        group.push(item);
        progressGroups.set(key, group);
      }

      for (const group of progressGroups.values()) {
        if (group.length > 1) {
          // Keep the one with latest lastUpdated
          group.sort((a, b) => b.lastUpdated - a.lastUpdated);
          // Delete the rest
          for (let i = 1; i < group.length; i++) {
            if (group[i].id) progressToDelete.push(group[i].id!);
          }
        }
      }

      if (progressToDelete.length > 0) {
        await db.episodeProgress.bulkDelete(progressToDelete);
        report.episodeProgressRemoved = progressToDelete.length;
        console.log(`CleanupAgent: Removed ${progressToDelete.length} duplicate episode progress items`);
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during cleanup';
      console.error('CleanupAgent error:', error);
      report.errors.push(errorMessage);
    }

    return report;
  }
};
