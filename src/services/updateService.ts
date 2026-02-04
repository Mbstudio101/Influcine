import { Capacitor } from '@capacitor/core';
import { AppVersion } from '../types';

const GITHUB_REPO = 'Mbstudio101/influcine';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// Storage keys
const STORAGE_KEY_LAST_CHECK = 'update_last_checked';
const STORAGE_KEY_SKIPPED_VERSION = 'update_skipped_version';
// const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Helper to compare semantic versions (e.g. "1.0.0" vs "1.0.1")
const compareVersions = (v1: string, v2: string): number => {
  const p1 = v1.replace(/[^\d.]/g, '').split('.').map(Number);
  const p2 = v2.replace(/[^\d.]/g, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
};

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  body: string;
  assets: GitHubAsset[];
}

const isElectron = typeof window !== 'undefined' && (window.ipcRenderer || navigator.userAgent.includes('Electron'));

export const downloadUpdate = async () => {
  if (isElectron && window.ipcRenderer) {
    return window.ipcRenderer.invoke('update-download');
  }
  throw new Error('Not supported');
};

export const installUpdate = async () => {
  if (isElectron && window.ipcRenderer) {
    return window.ipcRenderer.invoke('update-install');
  }
  throw new Error('Not supported');
};

export const onUpdateProgress = (callback: (progress: { percent: number }) => void) => {
  if (isElectron && window.ipcRenderer) {
    const listener = (_event: unknown, progress: { percent: number }) => callback(progress);
    window.ipcRenderer.on('update-progress', listener);
    return () => window.ipcRenderer?.off('update-progress', listener); // Use optional chaining for cleanup safety
  }
  return () => {};
};

export const onUpdateDownloaded = (callback: () => void) => {
  if (isElectron && window.ipcRenderer) {
    const listener = () => callback();
    window.ipcRenderer.on('update-downloaded', listener);
    return () => window.ipcRenderer?.off('update-downloaded', listener);
  }
  return () => {};
};

export const checkForUpdates = async (currentVersion: string): Promise<AppVersion | null> => {
  const now = Date.now();
  try {
    // Offline check
    if (!navigator.onLine) return null;

    // 1. Electron Native Check
    if (isElectron && window.ipcRenderer) {
      try {
        const result = await window.ipcRenderer.invoke('update-check');
        if (result.update) {
          return {
            latest: result.version,
            forceUpdate: false, 
            releaseNotes: result.releaseNotes || 'Update available',
            platforms: { macos: 'ipc', windows: 'ipc', linux: 'ipc' } // Marker for IPC handling
          };
        }
        return null; // No update
      } catch (err) {
        // console.warn('Electron update check failed, falling back to GitHub API', err);
        // Fallback to GitHub API below
      }
    }

    // 2. GitHub API Check (Web / Fallback)
    const response = await fetch(GITHUB_API_URL, { 
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        // console.warn('GitHub API rate limit reached');
      }
      return null;
    }
    
    const release: GitHubRelease = await response.json();
    const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
    
    // Update last checked time
    localStorage.setItem(STORAGE_KEY_LAST_CHECK, now.toString());

    // Compare versions
    if (compareVersions(latestVersion, currentVersion) <= 0) {
      return null; // Up to date
    }

    // Check if user skipped this version
    const skippedVersion = localStorage.getItem(STORAGE_KEY_SKIPPED_VERSION);
    // Parse metadata from body
    const isForced = release.body.includes('FORCE_UPDATE=true');
    const minVersionMatch = release.body.match(/MIN_SUPPORTED_VERSION=([\d.]+)/);
    const minSupportedVersion = minVersionMatch ? minVersionMatch[1] : null;

    let forceUpdate = isForced;
    if (minSupportedVersion && compareVersions(currentVersion, minSupportedVersion) < 0) {
      forceUpdate = true;
    }

    // If not forced and already skipped, return null
    if (!forceUpdate && skippedVersion === latestVersion) {
      return null;
    }

    // Map assets to platforms
    const platforms: AppVersion['platforms'] = {};
    
    release.assets.forEach(asset => {
      const name = asset.name.toLowerCase();
      const url = asset.browser_download_url;

      if (name.endsWith('.dmg')) platforms.macos = url;
      else if (!platforms.macos && name.endsWith('.zip') && name.includes('mac')) platforms.macos = url; // Fallback
      else if (name.endsWith('.exe')) platforms.windows = url;
      else if (name.endsWith('.apk')) platforms.androidtv = url;
      else if (name.endsWith('.AppImage') || name.endsWith('.deb')) platforms.linux = url;
    });

    // Fallback: If no assets match, check if version.json exists in repo
    // This handles the case where we just released but assets are uploading
    if (Object.keys(platforms).length === 0) {
      // console.warn('No platform assets found in GitHub release');
    }

    return {
      latest: latestVersion,
      forceUpdate,
      releaseNotes: release.body,
      platforms
    };

  } catch (error) {
    // console.error('Failed to check for updates:', error);
    return null;
  }
};

export const skipUpdate = (version: string) => {
  localStorage.setItem(STORAGE_KEY_SKIPPED_VERSION, version);
};

export const getPlatformDownloadLink = (version: AppVersion): string | null => {
  // 1. Detect Electron
  // ipcRenderer injected by preload script
  const isElectron = typeof window !== 'undefined' && (window.ipcRenderer || navigator.userAgent.includes('Electron'));
  
  if (isElectron) {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) return version.platforms.macos || null;
    if (platform.includes('win')) return version.platforms.windows || null;
    return version.platforms.linux || null;
  }

  // 2. Detect Capacitor (Mobile/TV)
  const capPlatform = Capacitor.getPlatform();
  if (capPlatform === 'android') return version.platforms.androidtv || null;
  
  // 3. Fallback based on User Agent
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return version.platforms.androidtv || null;
  if (ua.includes('mac os')) return version.platforms.macos || null;
  if (ua.includes('windows')) return version.platforms.windows || null;

  return null;
};
