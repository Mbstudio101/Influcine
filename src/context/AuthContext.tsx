import React, { useState, useEffect } from 'react';
import { db, User, Profile } from '../db';
import { AuthContext } from './useAuth';
import { supabase } from '../lib/supabase';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userRef = React.useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Restore session
  useEffect(() => {
    const initAuth = async () => {
      // ... (keep existing initAuth logic) ...
      try {
        // Check Supabase session first
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // If logged in with Supabase, verify/sync with local DB or just use Supabase
          // For now, we will map Supabase user to our local DB user structure for compatibility
          const email = session.user.email;
          if (email) {
            // Try to find local user by email, or create shadow user
            let userRecord = await db.users.where('email').equals(email).first();
            
            if (!userRecord) {
              // Create shadow local user for Supabase user
              const userId = await db.users.add({
                email,
                passwordHash: 'supabase_auth', // Placeholder
                createdAt: Date.now()
              });
              userRecord = await db.users.get(userId);
              
              // Create default profile for new shadow user
              const metadataName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'My Profile';
              await db.profiles.add({
                userId: userId as number,
                name: metadataName,
                avatarId: 'human-m-1',
                isKid: false,
                settings: {
                  autoplay: true,
                  subtitleSize: 'medium',
                  subtitleColor: 'white'
                }
              });
            }
            
            if (userRecord) {
              setUser(userRecord);
              const userProfiles = await db.profiles.where('userId').equals(userRecord.id!).toArray();
              setProfiles(userProfiles);
              
              const storedProfileId = localStorage.getItem('influcine_profile_id');
              if (storedProfileId) {
                const profileRecord = userProfiles.find(p => p.id === parseInt(storedProfileId));
                if (profileRecord) {
                  setProfile(profileRecord);
                }
              }
            }
          }
        } else {
           // Fallback to local auth if needed, or clear everything
           const storedUserId = localStorage.getItem('influcine_user_id');
           if (storedUserId) {
             // ... existing local auth restoration logic ...
             // For hybrid approach, we might want to keep this.
             // But for now, let's prioritize Supabase if configured.
             
             const userRecord = await db.users.get(parseInt(storedUserId));
             if (userRecord && userRecord.passwordHash !== 'supabase_auth') {
                setUser(userRecord);
                const userProfiles = await db.profiles.where('userId').equals(userRecord.id!).toArray();
                setProfiles(userProfiles);
                // ... profile restoration ...
                const storedProfileId = localStorage.getItem('influcine_profile_id');
                if (storedProfileId) {
                    const profileRecord = userProfiles.find(p => p.id === parseInt(storedProfileId));
                    if (profileRecord) setProfile(profileRecord);
                }
             } else {
               localStorage.removeItem('influcine_user_id');
               localStorage.removeItem('influcine_profile_id');
             }
           }
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();

    // Listen for Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email) {
         // Reload user/profiles similar to initAuth
         const email = session.user.email;
         let userRecord = await db.users.where('email').equals(email).first();
         if (!userRecord) {
             const userId = await db.users.add({
                email,
                passwordHash: 'supabase_auth',
                createdAt: Date.now()
              });
             userRecord = await db.users.get(userId);
             const metadataName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'My Profile';
             await db.profiles.add({
                userId: userId as number,
                name: metadataName,
                avatarId: 'human-m-1',
                isKid: false,
                settings: { autoplay: true, subtitleSize: 'medium', subtitleColor: 'white' }
              });
         }
         if (userRecord) {
             setUser(userRecord);
             const userProfiles = await db.profiles.where('userId').equals(userRecord.id!).toArray();
             
             // Sync profile name from Supabase metadata if default
             const metadataName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0];
             if (metadataName) {
               for (const p of userProfiles) {
                 if (p.name === 'John Doe' || p.name === 'My Profile') {
                   await db.profiles.update(p.id!, { name: metadataName });
                   p.name = metadataName;
                 }
               }
             }

             setProfiles(userProfiles);
         }
      } else {
        // Sign out
        // Only clear if it was a supabase user
        if (userRef.current?.passwordHash === 'supabase_auth') {
             setUser(null);
             setProfile(null);
             setProfiles([]);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfiles = async () => {
    if (!user?.id) return;
    const userProfiles = await db.profiles.where('userId').equals(user.id).toArray();
    setProfiles(userProfiles);
  };

  const login = async (email: string, password: string) => {
    // Try Supabase login first
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // If Supabase fails, check if it's a local-only user (legacy)
      // or just throw error
      console.warn("Supabase login failed, trying local fallback:", error.message);
      
      // Local Fallback
      // Helper for password hashing
      const hashPassword = async (p: string) => {
        const msgBuffer = new TextEncoder().encode(p);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      };
      
      const passwordHash = await hashPassword(password);
      const userRecord = await db.users.where('email').equals(email).first();

      if (!userRecord || userRecord.passwordHash !== passwordHash) {
         throw new Error(error.message || 'Invalid email or password');
      }

      setUser(userRecord);
      localStorage.setItem('influcine_user_id', userRecord.id!.toString());
      
      const userProfiles = await db.profiles.where('userId').equals(userRecord.id!).toArray();
      setProfiles(userProfiles);
      setProfile(null);
      localStorage.removeItem('influcine_profile_id');
      return;
    }

    // If Supabase login success, the onAuthStateChange listener will handle the state update
  };

  const signup = async (email: string, password: string) => {
    // Supabase Signup
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
    
    // Note: If email confirmation is enabled, user won't be signed in immediately
    // For this POC, we assume it might be disabled or user checks email.
    // If auto-confirm is on, onAuthStateChange will trigger.
  };

  const logout = async () => {
    // Supabase logout
    await supabase.auth.signOut();
    
    // Local logout
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
