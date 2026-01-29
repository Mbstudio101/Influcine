import { db } from '../db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: 'watch' | 'brain_off' | 'sleep' | 'taste' | 'meta';
  icon: string;
  tiers: {
    target: number;
    xp: number;
    titleSuffix?: string; // e.g., "I", "Master"
  }[];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // 🍿 Influcine Watch Achievements
  {
    id: 'binge_watcher',
    title: 'Just One More Scene',
    description: 'Episodes watched in one sitting',
    category: 'watch',
    icon: 'PlayCircle',
    tiers: [
      { target: 3, xp: 100, titleSuffix: 'I' },
      { target: 5, xp: 250, titleSuffix: 'II' },
      { target: 8, xp: 500, titleSuffix: 'III' },
      { target: 12, xp: 1000, titleSuffix: 'Master' }
    ]
  },
  {
    id: 'couch_potato',
    title: 'Couch Mode Activated',
    description: 'Hours watched in a day',
    category: 'watch',
    icon: 'Armchair',
    tiers: [
      { target: 4, xp: 150, titleSuffix: 'I' },
      { target: 8, xp: 400, titleSuffix: 'II' },
      { target: 12, xp: 800, titleSuffix: 'Master' }
    ]
  },
  
  // 😴 Sleep-Deprived Tier
  {
    id: 'night_owl',
    title: 'Sleep Is a Suggestion',
    description: 'Watch content after midnight',
    category: 'sleep',
    icon: 'Moon',
    tiers: [
      { target: 1, xp: 50, titleSuffix: 'I' },
      { target: 5, xp: 200, titleSuffix: 'II' },
      { target: 10, xp: 500, titleSuffix: 'Master' }
    ]
  },
  {
    id: 'early_bird',
    title: 'Sunrise Credits',
    description: 'Finish an episode between 4AM and 6AM',
    category: 'sleep',
    icon: 'Sun',
    tiers: [
      { target: 1, xp: 300, titleSuffix: 'Unique' }
    ]
  },

  // 🎭 Taste & Personality
  {
    id: 'drama_queen',
    title: 'Drama Enjoyer',
    description: 'Drama titles watched',
    category: 'taste',
    icon: 'Drama',
    tiers: [
      { target: 5, xp: 100, titleSuffix: 'Fan' },
      { target: 20, xp: 500, titleSuffix: 'Addict' }
    ]
  },
  
  // 🏆 Meta
  {
    id: 'first_blood',
    title: 'First Taste',
    description: 'Unlock your first badge',
    category: 'meta',
    icon: 'Trophy',
    tiers: [
      { target: 1, xp: 50 }
    ]
  },
  {
    id: 'completionist',
    title: 'Badge Collector',
    description: 'Total achievements unlocked',
    category: 'meta',
    icon: 'Award',
    tiers: [
      { target: 10, xp: 500, titleSuffix: 'Regular' },
      { target: 25, xp: 1500, titleSuffix: 'Collector' }
    ]
  }
];

export const calculateLevel = (xp: number) => {
  // Simple curve: Level = sqrt(XP / 100)
  // 100 XP = Lvl 1
  // 400 XP = Lvl 2
  // 900 XP = Lvl 3
  return Math.floor(Math.sqrt(xp / 100)) + 1;
};

export const getNextLevelXP = (level: number) => {
  return Math.pow(level, 2) * 100;
};

export const awardXP = async (profileId: number, amount: number) => {
  const profile = await db.profiles.get(profileId);
  if (!profile) return;

  const currentStats = profile.stats || {
    totalXP: 0,
    level: 1,
    streak: 0,
    lastWatchDate: Date.now(),
    hoursWatched: 0,
    moviesWatched: 0,
    seriesWatched: 0
  };

  const newXP = currentStats.totalXP + amount;
  const newLevel = calculateLevel(newXP);
  
  const didLevelUp = newLevel > currentStats.level;

  const newStats = {
    ...currentStats,
    totalXP: newXP,
    level: newLevel,
    lastWatchDate: Date.now(),
    hoursWatched: currentStats.hoursWatched || 0,
    moviesWatched: currentStats.moviesWatched || 0,
    seriesWatched: currentStats.seriesWatched || 0
  };

  await db.profiles.update(profileId, {
    stats: newStats
  });

  // Sync with Supabase if applicable
  const user = await db.users.get(profile.userId);
  if (user && user.passwordHash === 'supabase_auth') {
      await supabase.auth.updateUser({
          data: { stats: newStats }
      });
  }

  return { newXP, newLevel, didLevelUp };
};

export const updateWatchStats = async (
    profileId: number, 
    updates: { minutesWatched?: number; movieCompleted?: boolean; seriesCompleted?: boolean }
) => {
    const profile = await db.profiles.get(profileId);
    if (!profile) return;

    const currentStats = profile.stats || {
        totalXP: 0,
        level: 1,
        streak: 0,
        lastWatchDate: Date.now(),
        hoursWatched: 0,
        moviesWatched: 0,
        seriesWatched: 0
    };

    const newStats = { 
        ...currentStats,
        hoursWatched: currentStats.hoursWatched || 0,
        moviesWatched: currentStats.moviesWatched || 0,
        seriesWatched: currentStats.seriesWatched || 0
    };

    if (updates.minutesWatched) {
        // Convert to hours (float)
        const addedHours = updates.minutesWatched / 60;
        newStats.hoursWatched = (newStats.hoursWatched || 0) + addedHours;
        // Round to 2 decimal places for storage
        newStats.hoursWatched = Math.round(newStats.hoursWatched * 100) / 100;
    }

    if (updates.movieCompleted) {
        newStats.moviesWatched = (newStats.moviesWatched || 0) + 1;
    }

    if (updates.seriesCompleted) {
        newStats.seriesWatched = (newStats.seriesWatched || 0) + 1;
    }
    
    newStats.lastWatchDate = Date.now();

    await db.profiles.update(profileId, { stats: newStats });

    // Sync with Supabase
    const user = await db.users.get(profile.userId);
    if (user && user.passwordHash === 'supabase_auth' && isSupabaseConfigured) {
        await supabase.auth.updateUser({
            data: { stats: newStats }
        });
    }
    
    return newStats;
};

export const unlockAchievement = async (profileId: number, achievementId: string, progressVal: number) => {
  const def = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!def) return;

  // Check existing
  const existing = await db.achievements
    .where({ profileId, achievementId })
    .first();

  let currentTier = 0;
  if (existing) {
    currentTier = existing.tier;
  }

  // Determine unlocked tier
  let newTier = 0;
  let xpReward = 0;

  for (let i = 0; i < def.tiers.length; i++) {
    const tier = def.tiers[i];
    if (progressVal >= tier.target) {
      if (i + 1 > currentTier) {
        newTier = i + 1;
        xpReward += tier.xp;
      }
    }
  }

  if (newTier > currentTier) {
    // Unlock!
    if (existing) {
      await db.achievements.update(existing.id!, {
        tier: newTier,
        progress: progressVal,
        unlockedAt: Date.now(),
        isUnlocked: true
      });
    } else {
      await db.achievements.add({
        profileId,
        achievementId,
        tier: newTier,
        progress: progressVal,
        unlockedAt: Date.now(),
        isUnlocked: true
      });
    }

    // Award XP
    if (xpReward > 0) {
      await awardXP(profileId, xpReward);
    }
    
    return { unlocked: true, tier: newTier, name: def.title };
  } else {
    // Just update progress if no new tier
     if (existing) {
      await db.achievements.update(existing.id!, {
        progress: progressVal
      });
    } else {
      await db.achievements.add({
        profileId,
        achievementId,
        tier: 0,
        progress: progressVal,
        unlockedAt: 0,
        isUnlocked: false
      });
    }
  }
  
  return { unlocked: false };
};
