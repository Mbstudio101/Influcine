import { Capacitor } from '@capacitor/core';
import { AppVersion } from '../types';
import { logger } from './logger';
import { invoke } from '@tauri-apps/api/core';

const GITHUB_REPO = 'Mbstudio101/influcine';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

const STORAGE_KEY_SKIPPED_VERSION = 'update_skipped_version';

export const compareVersions = (v1: string, v2: string): number => {
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

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

export const downloadUpdate = async () => {
  throw new Error('Tauri uses GitHub release downloads — open the download URL in the browser.');
};

export const installUpdate = async () => {
  throw new Error('Tauri uses GitHub release downloads — open the download URL in the browser.');
};

export const onUpdateProgress = (_callback: (progress: { percent: number }) => void) => {
  return () => {};
};

export const onUpdateDownloaded = (_callback: () => void) => {
  return () => {};
};

export const checkForUpdates = async (currentVersion: string): Promise<AppVersion | null> => {
  try {
    if (!navigator.onLine) return null;

    // 1. Tauri backend check
    if (isTauri) {
      try {
        const result = await invoke<{ update: boolean; version?: string; releaseNotes?: string }>('update_check', { currentVersion });
        if (result.update && result.version) {
          return {
            latest: result.version,
            forceUpdate: false,
            releaseNotes: result.releaseNotes || 'Update available',
            platforms: {}
          };
        }
        if (result.update === false && !import.meta.env.DEV) {
          return null;
        }
      } catch (err) {
        logger.warn('Tauri update check failed, falling back to GitHub API', { error: String(err) });
      }
    }

    // 2. GitHub API Check (Web / Fallback)
    const response = await fetch(GITHUB_API_URL, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (!response.ok) {
      if (response.status === 403 || response.status === 429) {
        logger.warn('GitHub API rate limit reached');
      }
      return null;
    }

    const release: GitHubRelease = await response.json();
    const latestVersion = release.tag_name.replace(/^v/, '');

    if (compareVersions(latestVersion, currentVersion) <= 0) return null;

    const skippedVersion = localStorage.getItem(STORAGE_KEY_SKIPPED_VERSION);
    const isForced = release.body.includes('FORCE_UPDATE=true');
    const minVersionMatch = release.body.match(/MIN_SUPPORTED_VERSION=([\d.]+)/);
    const minSupportedVersion = minVersionMatch ? minVersionMatch[1] : null;

    let forceUpdate = isForced;
    if (minSupportedVersion && compareVersions(currentVersion, minSupportedVersion) < 0) {
      forceUpdate = true;
    }

    if (!forceUpdate && skippedVersion === latestVersion) return null;

    const platforms: AppVersion['platforms'] = {};
    release.assets.forEach(asset => {
      const name = asset.name.toLowerCase();
      const url = asset.browser_download_url;
      if (name.endsWith('.dmg')) platforms.macos = url;
      else if (!platforms.macos && name.endsWith('.zip') && name.includes('mac')) platforms.macos = url;
      else if (name.endsWith('.exe') || name.endsWith('.msi')) platforms.windows = url;
      else if (name.endsWith('.apk')) platforms.androidtv = url;
      else if (name.endsWith('.AppImage') || name.endsWith('.deb')) platforms.linux = url;
    });

    return {
      latest: latestVersion,
      forceUpdate,
      releaseNotes: release.body,
      platforms
    };

  } catch (error) {
    logger.warn('Failed to check for updates', { error: String(error) });
    return null;
  }
};

export const skipUpdate = (version: string) => {
  localStorage.setItem(STORAGE_KEY_SKIPPED_VERSION, version);
};

export const getPlatformDownloadLink = (version: AppVersion): string | null => {
  if (isTauri) {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) return version.platforms.macos || null;
    if (platform.includes('win')) return version.platforms.windows || null;
    return version.platforms.linux || null;
  }

  const capPlatform = Capacitor.getPlatform();
  if (capPlatform === 'android') return version.platforms.androidtv || null;

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return version.platforms.androidtv || null;
  if (ua.includes('mac os')) return version.platforms.macos || null;
  if (ua.includes('windows')) return version.platforms.windows || null;

  return null;
};
