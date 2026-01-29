import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { MediaDetails } from '../types';

export type PlayerMode = 'full' | 'mini' | 'hidden';

interface PlayerState {
  mode: PlayerMode;
  media: MediaDetails | null;
  season?: number;
  episode?: number;
  startTime?: number;
  // If we are playing a download
  localFilePath?: string;
}

interface PlayerContextType {
  state: PlayerState;
  play: (media: MediaDetails, season?: number, episode?: number, startTime?: number, localFilePath?: string) => void;
  close: () => void;
  minimize: () => void;
  maximize: () => void;
  togglePip: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PlayerState>({
    mode: 'hidden',
    media: null,
  });

  const play = useCallback((media: MediaDetails, season?: number, episode?: number, startTime = 0, localFilePath?: string) => {
    setState({
      mode: 'full',
      media,
      season,
      episode,
      startTime,
      localFilePath
    });
  }, []);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, mode: 'hidden', media: null }));
  }, []);

  const minimize = useCallback(() => {
    setState(prev => ({ ...prev, mode: 'mini' }));
  }, []);

  const maximize = useCallback(() => {
    setState(prev => ({ ...prev, mode: 'full' }));
  }, []);

  const togglePip = useCallback(() => {
    setState(prev => ({ ...prev, mode: prev.mode === 'full' ? 'mini' : 'full' }));
  }, []);

  return (
    <PlayerContext.Provider value={{ state, play, close, minimize, maximize, togglePip }}>
      {children}
    </PlayerContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
