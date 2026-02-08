import React from 'react';
import { motion } from 'framer-motion';
import { AchievementDef } from '../../services/achievements';
import { 
  PlayCircle, Armchair, Moon, Sun, Drama, Trophy, Award, Lock, LucideIcon 
} from 'lucide-react';

interface AchievementCardProps {
  def: AchievementDef;
  tier: number; // 0 = locked
  progress: number;
  onClick: () => void;
}

const IconMap: Record<string, LucideIcon> = {
  PlayCircle, Armchair, Moon, Sun, Drama, Trophy, Award
};

export const AchievementCard: React.FC<AchievementCardProps> = ({ def, tier, progress, onClick }) => {
  const Icon = IconMap[def.icon] || Trophy;
  const isLocked = tier === 0;
  
  // Get current tier target for progress display
  const nextTierIndex = isLocked ? 0 : Math.min(tier, def.tiers.length - 1);
  const nextTarget = def.tiers[nextTierIndex]?.target ?? 1;
  const isMaxed = tier >= def.tiers.length && progress >= def.tiers[def.tiers.length - 1].target;

  // Calculate progress percentage towards the next tier
  const target = isLocked ? nextTarget : (isMaxed ? nextTarget : nextTarget);
  const percent = Math.min(100, (progress / target) * 100);

  const tierColors = [
    'text-gray-500 border-gray-500', // Locked
    'text-blue-400 border-blue-400', // I
    'text-purple-400 border-purple-400', // II
    'text-orange-400 border-orange-400', // III
    'text-yellow-400 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]', // Master
  ];
  
  const activeColor = tierColors[tier] || tierColors[0];

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative group aspect-square rounded-2xl p-4 flex flex-col items-center justify-center border-2 bg-white/5 transition-all duration-300 ${
        isLocked ? 'border-white/5 opacity-50 grayscale' : `border-white/10 hover:border-white/20 bg-white/10`
      }`}
    >
      <div className={`p-4 rounded-full mb-3 relative ${isLocked ? 'bg-white/5' : 'bg-white/10'}`}>
        {isLocked ? (
          <Lock size={24} className="text-gray-500" />
        ) : (
          <Icon size={32} className={activeColor.split(' ')[0]} />
        )}
        
        {/* Tier Indicator */}
        {!isLocked && (
           <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-black border border-white/20 flex items-center justify-center text-[10px] font-bold text-white">
             {tier}
           </div>
        )}
      </div>

      <div className="text-center">
        <h4 className={`text-sm font-bold leading-tight mb-1 ${isLocked ? 'text-gray-500' : 'text-white'}`}>
          {def.title}
        </h4>
        <div className="h-1 w-12 mx-auto bg-white/10 rounded-full overflow-hidden mt-2">
           <div 
             className={`h-full ${isLocked ? 'bg-gray-600' : 'bg-primary'}`} 
             style={{ width: `${isMaxed ? 100 : percent}%` }}
           />
        </div>
      </div>
    </motion.button>
  );
};
