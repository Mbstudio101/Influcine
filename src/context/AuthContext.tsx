import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
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
    const handleSession = async (session: Session | null) => {
      if (session?.user?.email) {
         const email = session.user.email;
         let userRecord = await db.users.where('email').equals(email).first();
         
         if (!userRecord) {
             // Create shadow local user
             const userId = await db.users.add({
                email,
                passwordHash: 'supabase_auth',
                createdAt: Date.now()
              });
             userRecord = await db.users.get(userId);
             
             // Create default profile if none exists
             const existingProfiles = await db.profiles.where('userId').equals(userId).count();
             if (existingProfiles === 0) {
               const metadataName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'My Profile';
               await db.profiles.add({
                  userId: userId as number,
                  name: metadataName,
                  avatarId: 'human-m-1',
                  isKid: false,
                  settings: { autoplay: true, subtitleSize: 'medium', subtitleColor: 'white' }
                });
             }
         }
         
         if (userRecord) {
             setUser(userRecord);
             
             // Sync profile from Supabase metadata
             const metadata = session.user.user_metadata || {};
             const profileName = metadata.full_name || metadata.name || session.user.email?.split('@')[0] || 'My Profile';
             const avatarId = metadata.avatar_id || 'human-m-1';
             const settings = metadata.settings || { autoplay: true, subtitleSize: 'medium', subtitleColor: 'white' };

             let userProfiles = await db.profiles.where('userId').equals(userRecord.id!).toArray();
             
             if (userProfiles.length === 0) {
                 await db.profiles.add({
                    userId: userRecord.id!,
                    name: profileName,
                    avatarId: avatarId,
                    isKid: false,
                    settings: settings
                  });
             } else {
                 // Update the primary profile with Supabase data (Source of Truth)
                 const primaryProfile = userProfiles[0];
                 await db.profiles.update(primaryProfile.id!, { 
                     name: profileName,
                     avatarId: avatarId,
                     settings: settings
                 });
                 
                 // Remove duplicates if any exist (Enforce Single Profile)
                 if (userProfiles.length > 1) {
                     const idsToDelete = userProfiles.slice(1).map(p => p.id!);
                     await db.profiles.bulkDelete(idsToDelete);
                 }
             }

             // Refresh profiles
             userProfiles = await db.profiles.where('userId').equals(userRecord.id!).toArray();
             setProfiles(userProfiles);
             setProfile(userProfiles[0]); // Auto-select
         }
      } else {
        // Sign out if it was a supabase user
        if (userRef.current?.passwordHash === 'supabase_auth') {
             setUser(null);
             setProfile(null);
             setProfiles([]);
        }
      }
    };

    const initAuth = async () => {
      try {
        // Check Supabase session first
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          await handleSession(session);
        } else {
           // Fallback to local auth if needed
           const storedUserId = localStorage.getItem('influcine_user_id');
           if (storedUserId) {
             const userRecord = await db.users.get(parseInt(storedUserId));
             if (userRecord && userRecord.passwordHash !== 'supabase_auth') {
                setUser(userRecord);
                const userProfiles = await db.profiles.where('userId').equals(userRecord.id!).toArray();
                
                // Enforce single profile
                if (userProfiles.length > 0) {
                  setProfiles([userProfiles[0]]);
                  setProfile(userProfiles[0]);
                } else {
                  setProfiles([]);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return; // Handled by initAuth
      await handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfiles = async () => {
    if (!user?.id) return;
    const userProfiles = await db.profiles.where('userId').equals(user.id).toArray();
    
    // Enforce single profile view
    if (userProfiles.length > 0) {
      setProfiles([userProfiles[0]]);
    } else {
      setProfiles([]);
    }
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
      
      // Enforce single profile
      if (userProfiles.length > 0) {
        setProfiles([userProfiles[0]]);
        setProfile(userProfiles[0]);
      } else {
        setProfiles([]);
        setProfile(null);
      }
      
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
    
    // Enforce single profile limit
    const existingCount = await db.profiles.where('userId').equals(user.id).count();
    if (existingCount >= 1) throw new Error('Single profile policy enforced. Cannot add more profiles.');

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
    
    // If Supabase user, sync the new profile (though this case is rare as handleSession creates one)
    if (user.passwordHash === 'supabase_auth') {
         await supabase.auth.updateUser({
            data: {
                full_name: name,
                name: name,
                avatar_id: avatarId,
                settings: { autoplay: true, subtitleSize: 'medium', subtitleColor: 'white' }
            }
         });
    }

    await refreshProfiles();
  };

  const updateProfile = async (profileId: number, data: Partial<Profile>) => {
    await db.profiles.update(profileId, data);
    
    // Update local state if it's the current profile
    if (profile?.id === profileId) {
      setProfile(prev => prev ? { ...prev, ...data } : null);
    }
    
    // Sync with Supabase if applicable
    if (user?.passwordHash === 'supabase_auth') {
        const updates: Record<string, string | object> = {};
        if (data.name) {
            updates.full_name = data.name;
            updates.name = data.name;
        }
        if (data.avatarId) updates.avatar_id = data.avatarId;
        if (data.settings) updates.settings = data.settings;
        
        if (Object.keys(updates).length > 0) {
            await supabase.auth.updateUser({ data: updates });
        }
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
