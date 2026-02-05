import { electronService } from './electron';

class ImageFallbackAgent {
  private cache: Map<string, string> = new Map();
  private pending: Map<string, Promise<string | null>> = new Map();

  /**
   * Retrieves an image URL for a given actor name.
   * Checks memory cache, then session storage, then falls back to Electron scraper.
   */
  async getActorImage(name: string): Promise<string | null> {
    if (!name) return null;

    // 1. Check Memory Cache
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    // 2. Check Session Storage (persistence across page reloads)
    const sessionKey = `actor_img_${name}`;
    const sessionVal = sessionStorage.getItem(sessionKey);
    if (sessionVal) {
      this.cache.set(name, sessionVal);
      return sessionVal;
    }

    // 3. Check Pending Requests (Deduplication)
    if (this.pending.has(name)) {
      return this.pending.get(name)!;
    }

    // 4. Fetch from Backend
    const promise = (async () => {
      try {
        // Add a small delay to avoid hammering if many requests come in at once
        // (Though the backend should handle this, the UI might spawn 20 at once)
        const url = await electronService.getActorImage(name);
        
        if (url) {
          this.cache.set(name, url);
          sessionStorage.setItem(sessionKey, url);
          return url;
        }
      } catch (e) {
        console.warn(`[ImageFallback] Failed to fetch image for: ${name}`, e);
      }
      return null;
    })();

    this.pending.set(name, promise);
    
    try {
      return await promise;
    } finally {
      this.pending.delete(name);
    }
  }

  /**
   * Clears the memory cache.
   */
  clearCache() {
    this.cache.clear();
    this.pending.clear();
  }
}

export const imageFallbackAgent = new ImageFallbackAgent();
