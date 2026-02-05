/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AudioSettings {
  spatialEnabled: boolean;
  outputMode: 'stereo' | 'surround-5.1' | 'atmos-passthrough' | 'binaural-virtualized';
}

export interface Settings {
  themeColor: string;
  subtitleSize: 'small' | 'medium' | 'large';
  subtitleColor: 'white' | 'yellow' | 'cyan';
  autoplay: boolean;
  reducedMotion: boolean;
  defaultLanguage: string;
  audio: AudioSettings;
  profile: {
    name: string;
    avatarId: string;
  };
}

interface SettingsContextType extends Settings {
  updateSettings: (newSettings: Partial<Settings>) => void;
  updateProfile: (profile: Partial<Settings['profile']>) => void;
  updateAudio: (audio: Partial<AudioSettings>) => void;
}

const defaultSettings: Settings = {
  themeColor: '#7c3aed',
  subtitleSize: 'medium',
  subtitleColor: 'white',
  autoplay: true,
  reducedMotion: false,
  defaultLanguage: 'English',
  audio: {
    spatialEnabled: false,
    outputMode: 'stereo',
  },
  profile: {
    name: 'John Doe',
    avatarId: 'human-m-1',
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('app-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('app-settings', JSON.stringify(settings));
    
    // Apply theme color
    // We need to set the variable that Tailwind uses.
    // In src/index.css, it is defined as --color-primary inside @theme.
    // CSS variables in @theme are set on the root element but with a different mechanism in v4 potentially.
    // However, usually setting it on :root works if it's a standard CSS variable.
    // Let's assume standard CSS variable behavior for now as seen in index.css.
    document.documentElement.style.setProperty('--color-primary', settings.themeColor);
    
    // Apply reduced motion
    if (settings.reducedMotion) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }

  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const updateProfile = (newProfile: Partial<Settings['profile']>) => {
    setSettings(prev => ({
      ...prev,
      profile: { ...prev.profile, ...newProfile }
    }));
  };

  const updateAudio = (newAudio: Partial<AudioSettings>) => {
    setSettings(prev => ({
      ...prev,
      audio: { ...prev.audio, ...newAudio }
    }));
  };

  return (
    <SettingsContext.Provider value={{ ...settings, updateSettings, updateProfile, updateAudio }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
