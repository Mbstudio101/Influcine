import React from 'react';
import { motion } from 'framer-motion';
import { getNextLevelXP } from '../../services/achievements';

interface LevelProgressProps {
  level: number;
  currentXP: number;
}

export const LevelProgress: React.FC<LevelProgressProps> = ({ level, currentXP }) => {
  const nextLevelXP = getNextLevelXP(level);
  const prevLevelXP = getNextLevelXP(level - 1);
  
  // Calculate progress within current level
  const range = nextLevelXP - prevLevelXP;
  const progress = currentXP - prevLevelXP;
  const percentage = Math.min(100, Math.max(0, (progress / range) * 100));

  return (
    <div className="w-full bg-white/5 rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold text-white">Level {level}</h3>
          <p className="text-sm text-gray-400">Master Watcher</p>
        </div>
        <div className="text-right">
          <span className="text-primary font-mono font-bold">{Math.floor(currentXP)}</span>
          <span className="text-gray-500 font-mono"> / {nextLevelXP} XP</span>
        </div>
      </div>
      
      <div className="h-4 bg-black/40 rounded-full overflow-hidden relative">
        <motion.div 
          className="absolute top-0 left-0 h-full bg-linear-to-r from-primary to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        {/* Shine effect */}
        <div className="absolute top-0 left-0 h-full w-full bg-linear-to-b from-white/10 to-transparent pointer-events-none" />
      </div>
      
      <div className="mt-2 flex justify-between text-xs text-gray-500 uppercase tracking-wider">
        <span>Level {level}</span>
        <span>{Math.round(range - progress)} XP to Level {level + 1}</span>
      </div>
    </div>
  );
};
