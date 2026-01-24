import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ACHIEVEMENTS } from '../../services/achievements';
import { AchievementCard } from './AchievementCard';
import { Achievement } from '../../db';
import { X, Trophy } from 'lucide-react';

interface AchievementGridProps {
  userAchievements: Achievement[];
}

export const AchievementGrid: React.FC<AchievementGridProps> = ({ userAchievements }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const getAchievementStatus = (id: string) => {
    const found = userAchievements.find(a => a.achievementId === id);
    return {
      tier: found?.tier || 0,
      progress: found?.progress || 0,
      unlockedAt: found?.unlockedAt
    };
  };

  const selectedDef = selectedId ? ACHIEVEMENTS.find(a => a.id === selectedId) : null;
  const selectedStatus = selectedId ? getAchievementStatus(selectedId) : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Trophy className="text-primary" /> Badges
        </h3>
        <div className="text-sm text-gray-400">
          {userAchievements.filter(a => a.isUnlocked).length} / {ACHIEVEMENTS.length} Unlocked
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {ACHIEVEMENTS.map(def => {
          const status = getAchievementStatus(def.id);
          return (
            <AchievementCard 
              key={def.id}
              def={def}
              tier={status.tier}
              progress={status.progress}
              onClick={() => setSelectedId(def.id)}
            />
          );
        })}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedId && selectedDef && selectedStatus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Background Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

              <button 
                onClick={() => setSelectedId(null)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} className="text-white" />
              </button>

              <div className="relative z-10 text-center space-y-6">
                <div className="w-24 h-24 mx-auto bg-white/5 rounded-full flex items-center justify-center border-2 border-primary/50 shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)]">
                   {/* We reuse the icon logic or just pass a generic one for now */}
                   <Trophy size={48} className="text-primary" />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedDef.title}</h2>
                  <p className="text-gray-400">{selectedDef.description}</p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 text-left space-y-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Current Progress</span>
                    <span className="text-white font-mono">{selectedStatus.progress}</span>
                  </div>
                  
                  {selectedDef.tiers.map((tier, idx) => {
                     const isUnlocked = (idx + 1) <= selectedStatus.tier;
                     
                     return (
                       <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg ${isUnlocked ? 'bg-primary/10 border border-primary/30' : 'bg-black/20 border border-white/5'}`}>
                         <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isUnlocked ? 'bg-primary text-white' : 'bg-white/10 text-gray-500'}`}>
                           {idx + 1}
                         </div>
                         <div className="flex-1">
                           <div className={`text-sm font-medium ${isUnlocked ? 'text-white' : 'text-gray-500'}`}>
                             Tier {idx + 1}
                             {tier.titleSuffix && <span className="text-xs opacity-70 ml-2">({tier.titleSuffix})</span>}
                           </div>
                           <div className="text-xs text-gray-500">Target: {tier.target}</div>
                         </div>
                         {isUnlocked && <Trophy size={14} className="text-primary" />}
                       </div>
                     );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
