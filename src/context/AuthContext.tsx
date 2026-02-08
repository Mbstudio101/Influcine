import React, { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, User, Profile } from '../db';
import { AuthContext } from './useAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { errorAgent } from '../services/errorAgent';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize IDs from localStorage
  const [userId, setUserId] = useState<number | null>(() => {
    const stored = localStorage.getItem('influcine_user_id');
    return stored ? parseInt(stored) : null;
  });

  const [profileId, setProfileId] = useState<number | null>(() => {
    const stored = localStorage.getItem('influcine_profile_id');
    return stored ? parseInt(stored) : null;
  });

  const [isLoading, setIsLoading] = useState(true);

  // Reactive State via Dexie
  const user = useLiveQuery(
    async () => {
      if (!userId) return null;
      const u = await db.users.get(userId);
      return u ?? null;
    },
    [userId]
  ) ?? null;

  const profiles = useLiveQuery(
    async () => {
      if (!userId) return [] as Profile[];
      return await db.profiles.where('userId').equals(userId).toArray();
    },
    [userId]
  ) ?? [];

  const profile = useLiveQuery(
    async () => {
      if (!profileId) return null;
      const p = await db.profiles.get(profileId);
      return p ?? null;
    },
    [profileId]
  ) ?? null;

  // Persist IDs when they change (backup to localStorage updates)
  useEffect(() => {
    if (userId) {
      localStorage.setItem('influcine_user_id', userId.toString());
    } else {
      localStorage.removeItem('influcine_user_id');
    }
  }, [userId]);

  useEffect(() => {
    if (profileId) {
      localStorage.setItem('influcine_profile_id', profileId.toString());
    } else {
      localStorage.removeItem('influcine_profile_id');
    }
  }, [profileId]);

  // Handle Supabase Session Sync
  const handleSession = useCallback(async (session: Session | null) => {
    if (session?.user?.email) {
       const email = session.user.email;
       let userRecord = await db.users.where('email').equals(email).first();
       
       if (!userRecord) {
           // Create shadow local user
           const newUserId = await db.users.add({
              email,
              passwordHash: 'supabase_auth',
              createdAt: Date.now()
            });
           userRecord = await db.users.get(newUserId);
           
           // Create default profile if none exists
           const existingProfiles = await db.profiles.where('userId').equals(newUserId).count();
           if (existingProfiles === 0) {
             const metadataName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'My Profile';
             await db.profiles.add({
                userId: newUserId as number,
                name: metadataName,
                avatarId: 'human-m-1',
                isKid: false,
                settings: { autoplay: true, subtitleSize: 'medium', subtitleColor: 'white' }
              });
           }
       }
       
       if (userRecord) {
           // Set the active user ID
           setUserId(userRecord.id!);
           
           // Sync profile from Supabase metadata
           const metadata = session.user.user_metadata || {};
           const profileName = metadata.full_name || metadata.name || session.user.email?.split('@')[0] || 'My Profile';
           const avatarId = metadata.avatar_id || 'human-m-1';
           const settings = metadata.settings || { autoplay: true, subtitleSize: 'medium', subtitleColor: 'white' };
           const defaultStats = {
              totalXP: 0,
              level: 1,
              streak: 0,
              lastWatchDate: Date.now(),
              hoursWatched: 0,
              moviesWatched: 0,
              seriesWatched: 0
           };
           const stats = metadata.stats;

           let userProfiles = await db.profiles.where('userId').equals(userRecord.id!).toArray();
           
           // Cleanup duplicates logic
           if (userProfiles.length > 1) {
               const uniqueProfiles: Profile[] = [];
               const toDelete: number[] = [];
               const seenNames = new Set<string>();

               for (const p of userProfiles) {
                   const normalizedName = p.name.trim().toLowerCase();
                   if (seenNames.has(normalizedName)) {
                       toDelete.push(p.id!);
                   } else {
                       seenNames.add(normalizedName);
                       uniqueProfiles.push(p);
                   }
               }

               if (toDelete.length > 0) {
                  await db.profiles.bulkDelete(toDelete);
               }
               userProfiles = uniqueProfiles;
           }
           
           if (userProfiles.length === 0) {
               await db.profiles.add({
                  userId: userRecord.id!,
                  name: profileName,
                  avatarId: avatarId,
                  isKid: false,
                  settings: settings,
                  stats: stats || defaultStats
                });
           } else {
               // Update the primary profile
               const primaryProfile = userProfiles[0];
               const updates: Partial<Profile> = { 
                   name: profileName,
                   avatarId: avatarId,
                   settings: settings
               };
               if (stats) {
                   updates.stats = stats;
               }
               await db.profiles.update(primaryProfile.id!, updates);
           }
      }
   } else {
      // Sign out if it was a supabase user
      // We check if current user is supabase_auth. 
      // Since 'user' object might be null or not updated yet, we check the DB or just clear if we know we are in a signed-out state from Supabase.
      if (userId) {
          const u = await db.users.get(userId);
          if (u && u.passwordHash === 'supabase_auth') {
             setUserId(null);
             setProfileId(null);
          }
      }
    }
  }, [userId]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        let session = null;
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            // If there's an error (e.g. 403 Forbidden, invalid token), ensure we clear any stale state
            await supabase.auth.signOut().catch((e) => {
              errorAgent.log({ message: 'Failed to sign out during session error cleanup', type: 'WARN', context: { error: String(e) } });
            });
            // Robust cleanup
            for (const key of Object.keys(localStorage)) {
                if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    localStorage.removeItem(key);
                }
            }
          } else {
            session = data.session;
          }
        }
        
        if (session) {
          await handleSession(session);
        } else {
           // Fallback to local auth if needed
           if (userId && !profileId) {
             // Just ensure we have the user loaded, but don't auto-select profile
           }
        }
      } catch (error) {
        errorAgent.log({ message: 'Failed to restore session', type: 'ERROR', context: { error: String(error) } });
        // Force cleanup on error
        await supabase.auth.signOut().catch((e) => {
          errorAgent.log({ message: 'Signout failed during session restore cleanup', type: 'WARN', context: { error: String(e) } });
        });
        localStorage.removeItem('sb-' + new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0] + '-auth-token');
        // Also try generic cleanup for robustness
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key);
            }
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return; 
      await handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, [handleSession, profileId, userId]); // Run once on mount or when dependencies change

  const login = async (email: string, password: string) => {
    let error = null;
    
    if (isSupabaseConfigured) {
      const { error: supabaseError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      error = supabaseError;
    } else {
      error = { message: 'Supabase not configured' };
    }

    if (error) {
      if (isSupabaseConfigured) {
        errorAgent.log({ message: 'Supabase login failed, trying local fallback', type: 'WARN', context: { errorMessage: error.message } });
      }
      
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

      setUserId(userRecord.id!);
      
      // Do not auto-select profile on login. Let the user choose.
      setProfileId(null);
      
      return;
    }
  };

  const signup = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setProfileId(null);
    localStorage.removeItem('influcine_user_id');
    localStorage.removeItem('influcine_profile_id');
  };

  const switchProfile = async (id: number) => {
    // Verify it belongs to user
    const p = await db.profiles.get(id);
    if (p && p.userId === userId) {
        setProfileId(id);
    } else {
        throw new Error('Profile not found');
    }
  };

  const addProfile = async (name: string, avatarId: string, isKid: boolean = false) => {
    if (!userId) throw new Error('Not authenticated');
    
    const existingCount = await db.profiles.where('userId').equals(userId).count();
    if (existingCount >= 5) throw new Error('Maximum number of profiles reached (5).');

    await db.profiles.add({
      userId,
      name,
      avatarId,
      isKid,
      settings: {
        autoplay: true,
        subtitleSize: 'medium',
        subtitleColor: 'white'
      }
    });
    
    // Sync with Supabase if needed
    if (user?.passwordHash === 'supabase_auth') {
         await supabase.auth.updateUser({
            data: {
                full_name: name,
                name: name,
                avatar_id: avatarId,
                settings: { autoplay: true, subtitleSize: 'medium', subtitleColor: 'white' }
            }
         });
    }
    // No need to refreshProfiles(), useLiveQuery handles it
  };

  const updateProfile = async (id: number, data: Partial<Profile>) => {
    await db.profiles.update(id, data);
    
    if (user?.passwordHash === 'supabase_auth' && id === profileId) {
        const updates: Record<string, string | object> = {};
        if (data.name) {
            updates.full_name = data.name;
            updates.name = data.name;
        }
        if (data.avatarId) updates.avatar_id = data.avatarId;
        if (data.settings) updates.settings = data.settings;
        if (data.stats) updates.stats = data.stats;
        
        if (Object.keys(updates).length > 0) {
            await supabase.auth.updateUser({ data: updates });
        }
    }
  };

  const updateUser = async (data: Partial<User>) => {
    if (!userId) throw new Error('Not authenticated');

    if (data.email && user && data.email !== user.email) {
      const existing = await db.users.where('email').equals(data.email).first();
      if (existing) {
        throw new Error('Email already taken');
      }
    }

    await db.users.update(userId, data);
  };

  const deleteProfile = async (id: number) => {
    if (profiles.length <= 1) throw new Error('Cannot delete the last profile');
    
    await db.profiles.delete(id);
    
    if (profileId === id) {
      setProfileId(null);
    }
  };

  const refreshProfiles = async () => {
    // No-op, kept for compatibility if needed
    return Promise.resolve();
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
