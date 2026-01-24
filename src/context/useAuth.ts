import { createContext, useContext } from 'react';
import { User, Profile } from '../db';

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  profiles: Profile[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchProfile: (profileId: number) => Promise<void>;
  addProfile: (name: string, avatarId: string, isKid?: boolean) => Promise<void>;
  updateProfile: (profileId: number, data: Partial<Profile>) => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  deleteProfile: (profileId: number) => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
