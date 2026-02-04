import Dexie from 'dexie';

/**
 * Attempts to rescue the database from a broken state (e.g., UpgradeError).
 * If the database cannot be opened via Dexie, this function will:
 * 1. Connect using raw IndexedDB.
 * 2. Backup critical data (library, history).
 * 3. Delete the database.
 * 4. Restore the critical data into a new database instance.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function rescueDatabase(_dbName: string): Promise<boolean> {
  // We cannot rely on new Dexie(dbName).open() to detect errors because it might open an older version successfully
  // without triggering the upgrade logic that fails in the real app.
  // Instead, we export a function 'performRescue' that can be called when the main app detects failure.
  return false; 
}

export async function performRescue(dbName: string): Promise<boolean> {
  // console.error('[Rescue] Database is reported broken. Initiating rescue operation...');
  
  try {
    // 1. Backup Data via Raw IndexedDB
    const backup = await backupDataRaw(dbName, ['library', 'history']);
    if (import.meta.env.DEV) {
      // console.log(`[Rescue] Backed up ${backup.library?.length || 0} library items and ${backup.history?.length || 0} history items.`);
    }

    // 2. Delete Database
    await Dexie.delete(dbName);
    if (import.meta.env.DEV) {
      // console.log('[Rescue] Database deleted.');
    }

    // 3. Save backup to temp DB
    await saveBackupToTempDB(backup);
    if (import.meta.env.DEV) {
      // console.log('[Rescue] Backup saved to temporary storage.');
    }
    
    return true;
  } catch {
    // console.error('[Rescue] Critical failure during rescue:', rescueErr);
    return false;
  }
}

async function backupDataRaw(dbName: string, stores: string[]): Promise<Record<string, unknown[]>> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const result: Record<string, unknown[]> = {};
      
      const tx = db.transaction(db.objectStoreNames, 'readonly');
      let completed = 0;
      
      const availableStores = stores.filter(s => db.objectStoreNames.contains(s));
      
      if (availableStores.length === 0) {
        db.close();
        resolve({});
        return;
      }

      availableStores.forEach(storeName => {
        const store = tx.objectStore(storeName);
        const getAll = store.getAll();
        
        getAll.onsuccess = () => {
          result[storeName] = getAll.result;
          completed++;
          if (completed === availableStores.length) {
            db.close();
            resolve(result);
          }
        };
        getAll.onerror = () => {
          // console.warn(`[Rescue] Failed to read store ${storeName}`);
          completed++;
          if (completed === availableStores.length) {
            db.close();
            resolve(result);
          }
        };
      });
    };
  });
}

async function saveBackupToTempDB(data: Record<string, unknown[]>) {
  const tempDb = new Dexie('InflucineRescueDB');
  tempDb.version(1).stores({
    backup: 'key'
  });
  
  await tempDb.open();
  await tempDb.table('backup').put({ key: 'library', data: data.library || [] });
  await tempDb.table('backup').put({ key: 'history', data: data.history || [] });
  await tempDb.close();
}

export async function restoreFromRescueDB(targetDb: Dexie) {
  try {
    const tempDb = new Dexie('InflucineRescueDB');
    tempDb.version(1).stores({
       backup: 'key'
    });

    if (!(await Dexie.exists('InflucineRescueDB'))) {
       return;
    }

    await tempDb.open();
    const libraryBackup = await tempDb.table('backup').get('library');
    const historyBackup = await tempDb.table('backup').get('history');
    await tempDb.close();

    if (libraryBackup && libraryBackup.data && Array.isArray(libraryBackup.data)) {
       await targetDb.table('library').bulkPut(libraryBackup.data).catch(() => { /* console.warn('Restore library partial fail', e) */ });
       // console.log(`[Rescue] Restored ${libraryBackup.data.length} library items.`);
    }

    if (historyBackup && historyBackup.data && Array.isArray(historyBackup.data)) {
       await targetDb.table('history').bulkPut(historyBackup.data).catch(() => { /* console.warn('Restore history partial fail', e) */ });
       // console.log(`[Rescue] Restored ${historyBackup.data.length} history items.`);
    }
    
    // Clean up temp DB
    await Dexie.delete('InflucineRescueDB');

  } catch (e) {
    // console.error('[Rescue] Failed to restore from backup:', e);
  }
}
