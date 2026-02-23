export type TVAction = 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'playPause';

export type TVKeyProfile = 'auto' | 'default' | 'firetv' | 'androidtv' | 'roku' | 'tizen' | 'webos';
export const TV_KEY_PROFILE_STORAGE_KEY = 'influcine.tvKeyProfile';

interface ActionKeyMap {
  keys: string[];
  keyCodes: number[];
}

type ProfileMap = Record<TVAction, ActionKeyMap>;

const BASE_PROFILE: ProfileMap = {
  up: { keys: ['ArrowUp'], keyCodes: [38] },
  down: { keys: ['ArrowDown'], keyCodes: [40] },
  left: { keys: ['ArrowLeft'], keyCodes: [37] },
  right: { keys: ['ArrowRight'], keyCodes: [39] },
  select: { keys: ['Enter', 'Select'], keyCodes: [13, 23] },
  back: { keys: ['Escape', 'Backspace', 'GoBack', 'BrowserBack'], keyCodes: [4, 8, 27, 461] },
  playPause: { keys: ['MediaPlayPause', 'Play', 'Pause'], keyCodes: [179, 415, 19, 10252] },
};

const PROFILE_OVERRIDES: Record<Exclude<TVKeyProfile, 'auto' | 'default'>, Partial<ProfileMap>> = {
  firetv: {
    up: { keys: ['ArrowUp'], keyCodes: [19, 38] },
    down: { keys: ['ArrowDown'], keyCodes: [20, 40] },
    left: { keys: ['ArrowLeft'], keyCodes: [21, 37] },
    right: { keys: ['ArrowRight'], keyCodes: [22, 39] },
    select: { keys: ['Enter', 'Select'], keyCodes: [23, 13] },
    back: { keys: ['Escape', 'Backspace', 'GoBack', 'BrowserBack'], keyCodes: [4, 27, 8] },
  },
  androidtv: {
    up: { keys: ['ArrowUp'], keyCodes: [19, 38] },
    down: { keys: ['ArrowDown'], keyCodes: [20, 40] },
    left: { keys: ['ArrowLeft'], keyCodes: [21, 37] },
    right: { keys: ['ArrowRight'], keyCodes: [22, 39] },
    select: { keys: ['Enter', 'Select'], keyCodes: [23, 13, 66] },
    back: { keys: ['Escape', 'Backspace', 'GoBack', 'BrowserBack'], keyCodes: [4, 27, 8] },
  },
  roku: {
    select: { keys: ['Enter', 'Select', 'OK'], keyCodes: [13] },
    back: { keys: ['Escape', 'Backspace', 'GoBack', 'BrowserBack'], keyCodes: [27, 8, 461] },
  },
  tizen: {
    select: { keys: ['Enter', 'Select', 'OK'], keyCodes: [13, 29443] },
    back: { keys: ['Escape', 'Backspace', 'GoBack', 'BrowserBack'], keyCodes: [10009, 27, 8] },
    playPause: { keys: ['MediaPlayPause', 'Play', 'Pause'], keyCodes: [10252, 415, 19] },
  },
  webos: {
    select: { keys: ['Enter', 'Select', 'OK'], keyCodes: [13] },
    back: { keys: ['Escape', 'Backspace', 'GoBack', 'BrowserBack'], keyCodes: [461, 27, 8] },
    playPause: { keys: ['MediaPlayPause', 'Play', 'Pause'], keyCodes: [179, 415, 19] },
  },
};

const mergeProfile = (override?: Partial<ProfileMap>): ProfileMap => {
  if (!override) return BASE_PROFILE;
  const merged: Partial<ProfileMap> = {};
  (Object.keys(BASE_PROFILE) as TVAction[]).forEach((action) => {
    const base = BASE_PROFILE[action];
    const extra = override[action];
    merged[action] = {
      keys: Array.from(new Set([...(base.keys || []), ...((extra && extra.keys) || [])])),
      keyCodes: Array.from(new Set([...(base.keyCodes || []), ...((extra && extra.keyCodes) || [])])),
    };
  });
  return merged as ProfileMap;
};

const normalize = (value: string) => value.trim().toLowerCase();

export const detectTVKeyProfile = (): Exclude<TVKeyProfile, 'auto'> => {
  if (typeof navigator === 'undefined') return 'default';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('aft') || ua.includes('fire tv') || ua.includes('silk')) return 'firetv';
  if (ua.includes('android tv') || ua.includes('smarttv')) return 'androidtv';
  if (ua.includes('tizen')) return 'tizen';
  if (ua.includes('webos') || ua.includes('netcast')) return 'webos';
  if (ua.includes('roku')) return 'roku';
  return 'default';
};

export const resolveTVKeyProfile = (profile: TVKeyProfile = 'auto'): Exclude<TVKeyProfile, 'auto'> => {
  if (profile === 'auto') {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(TV_KEY_PROFILE_STORAGE_KEY) as TVKeyProfile | null;
      if (stored && stored !== 'auto') {
        return stored as Exclude<TVKeyProfile, 'auto'>;
      }
    }
    return detectTVKeyProfile();
  }
  return profile;
};

export const getTVProfileMap = (profile: TVKeyProfile = 'auto'): ProfileMap => {
  const resolved = resolveTVKeyProfile(profile);
  if (resolved === 'default') return BASE_PROFILE;
  return mergeProfile(PROFILE_OVERRIDES[resolved]);
};

export const isTVActionKey = (event: KeyboardEvent, action: TVAction, profile: TVKeyProfile = 'auto'): boolean => {
  const map = getTVProfileMap(profile)[action];
  const key = normalize(event.key || '');
  const keyCode = (event as KeyboardEvent & { keyCode?: number }).keyCode ?? 0;
  return map.keys.some((k) => normalize(k) === key) || map.keyCodes.includes(keyCode);
};
