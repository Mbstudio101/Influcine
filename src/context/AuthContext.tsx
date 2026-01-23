import React, { useState, useEffect } from 'react';
import { db, User, Profile } from '../db';
import { AuthContext } from './useAuth';

// Helper for password hashing
async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUserId = localStorage.getItem('influcine_user_id');
        const storedProfileId = localStorage.getItem('influcine_profile_id');

        if (storedUserId) {
          const userRecord = await db.users.get(parseInt(storedUserId));
          if (userRecord) {
            setUser(userRecord);
            const userProfiles = await db.profiles.where('userId').equals(userRecord.id!).toArray();
            setProfiles(userProfiles);

            if (storedProfileId) {
              const profileRecord = userProfiles.find(p => p.id === parseInt(storedProfileId));
              if (profileRecord) {
                setProfile(profileRecord);
              }
            }
          } else {
            // Invalid session
            localStorage.removeItem('influcine_user_id');
            localStorage.removeItem('influcine_profile_id');
          }
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const refreshProfiles = async () => {
    if (!user?.id) return;
    const userProfiles = await db.profiles.where('userId').equals(user.id).toArray();
    setProfiles(userProfiles);
  };

  const login = async (email: string, password: string) => {
    const passwordHash = await hashPassword(password);
    const userRecord = await db.users.where('email').equals(email).first();

    if (!userRecord || userRecord.passwordHash !== passwordHash) {
      throw new Error('Invalid email or password');
    }

    setUser(userRecord);
    localStorage.setItem('influcine_user_id', userRecord.id!.toString());
    
    // Load profiles
    const userProfiles = await db.profiles.where('userId').equals(userRecord.id!).toArray();
    setProfiles(userProfiles);
    
    // Reset profile selection on new login
    setProfile(null);
    localStorage.removeItem('influcine_profile_id');
  };

  const signup = async (email: string, password: string) => {
    const existing = await db.users.where('email').equals(email).first();
    if (existing) {
      throw new Error('Email already registered');
    }

    const passwordHash = await hashPassword(password);
    const userId = await db.users.add({
      email,
      passwordHash,
      createdAt: Date.now()
    });

    // Create default profile
    const defaultProfileId = await db.profiles.add({
      userId: userId as number,
      name: 'My Profile',
      avatarId: 'avatar-1',
      isKid: false,
      settings: {
        autoplay: true,
        subtitleSize: 'medium',
        subtitleColor: 'white'
      }
    });

    // Auto login
    const newUser = await db.users.get(userId);
    setUser(newUser!);
    localStorage.setItem('influcine_user_id', userId.toString());
    
    const newProfile = await db.profiles.get(defaultProfileId);
    setProfiles([newProfile!]);
    // Don't auto-select profile, let them see the "splash" screen or auto-select if preferred. 
    // Requirement says "splash screen... elegantly present all available profiles". So we don't auto-select.
  };

  const logout = async () => {
    setUser(null);
    setProfile(null);
    setProfiles([]);
    localStorage.removeItem('influcine_user_id');
    localStorage.removeItem('influcine_profile_id');
  };

  const switchProfile = async (profileId: number) => {
    const selected = profiles.find(p => p.id === profileId);
    if (!selected) throw new Error('Profile not found');
    
    setProfile(selected);
    localStorage.setItem('influcine_profile_id', profileId.toString());
  };

  const addProfile = async (name: string, avatarId: string, isKid: boolean = false) => {
    if (!user?.id) throw new Error('Not authenticated');
    if (profiles.length >= 5) throw new Error('Maximum of 5 profiles allowed');

    await db.profiles.add({
      userId: user.id,
      name,
      avatarId,
      isKid,
      settings: {
        autoplay: true,
        subtitleSize: 'medium',
        subtitleColor: 'white'
      }
    });
    await refreshProfiles();
  };

  const updateProfile = async (profileId: number, data: Partial<Profile>) => {
    await db.profiles.update(profileId, data);
    
    // Update local state if it's the current profile
    if (profile?.id === profileId) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
    }
    await refreshProfiles();
  };

  const updateUser = async (data: Partial<User>) => {
    if (!user?.id) throw new Error('Not authenticated');

    // If updating email, check uniqueness
    if (data.email && data.email !== user.email) {
      const existing = await db.users.where('email').equals(data.email).first();
      if (existing) {
        throw new Error('Email already taken');
      }
    }

    await db.users.update(user.id, data);
    setUser(prev => prev ? { ...prev, ...data } : null);
  };

  const deleteProfile = async (profileId: number) => {
    if (profiles.length <= 1) throw new Error('Cannot delete the last profile');
    
    await db.profiles.delete(profileId);
    
    if (profile?.id === profileId) {
      setProfile(null);
      localStorage.removeItem('influcine_profile_id');
    }
    await refreshProfiles();
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      profiles,
      isAuthenticated: !!user,
      isLoading,
      login,
      signup,
      logout,
      switchProfile,
      addProfile,
      updateProfile,
      updateUser,
      deleteProfile,
      refreshProfiles
    }}>
      {children}
    </AuthContext.Provider>
  );
};
