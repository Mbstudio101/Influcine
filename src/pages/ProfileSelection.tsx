import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Avatar, AVATARS } from '../components/Avatars';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Check } from 'lucide-react';

import Focusable from '../components/Focusable';
import { useQueryClient } from '@tanstack/react-query';
import { getPersonalizedRecommendations } from '../services/recommendations';

const ProfileSelection: React.FC = () => {
  const { profiles, switchProfile, addProfile, profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);
  const [targetProfileId, setTargetProfileId] = useState<number | null>(null);

  // Navigate only when the profile is fully loaded and matches selection
  useEffect(() => {
    if (targetProfileId !== null && profile?.id === targetProfileId) {
      navigate('/browse');
      setTargetProfileId(null);
    }
  }, [profile, targetProfileId, navigate]);

  const handleSelect = useCallback(
    async (profileId: number) => {
      try {
        setTargetProfileId(profileId);
        
        // Prefetch recommendations for the selected profile
        queryClient.prefetchQuery({
            queryKey: ['recommendations-home', profileId],
            queryFn: () => getPersonalizedRecommendations(profileId),
            staleTime: 1000 * 60 * 60, // 1 hour
        });

        await switchProfile(profileId);
      } catch (error) {
        console.error('Failed to switch profile:', error);
        setTargetProfileId(null);
      }
    },
    [switchProfile, queryClient]
  );

  const handleAddProfile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newProfileName.trim()) return;

    try {
      await addProfile(newProfileName, selectedAvatar);
      setIsAdding(false);
      setNewProfileName('');
      setSelectedAvatar(AVATARS[0].id);
    } catch (error) {
      console.error('Failed to add profile:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary/10 via-black to-black pointer-events-none" />
      
      <AnimatePresence mode="wait">
        {!isAdding ? (
          <motion.div 
            key="selection"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center z-10"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-12 drop-shadow-2xl">Who's watching?</h1>
            
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
              {profiles.map((profile) => (
                <Focusable
                  as={motion.div}
                  key={profile.id}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="group cursor-pointer flex flex-col items-center gap-4 outline-none"
                  onClick={() => profile.id && handleSelect(profile.id)}
                  activeClassName="ring-4 ring-primary rounded-xl scale-110"
                >
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-1 bg-linear-to-br from-white/10 to-white/5 border-2 border-transparent group-hover:border-white transition-all overflow-hidden relative shadow-2xl">
                    <Avatar id={profile.avatarId} />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                  </div>
                  <span className="text-gray-400 text-xl font-medium group-hover:text-white transition-colors">
                    {profile.name}
                  </span>
                </Focusable>
              ))}

              {profiles.length < 5 && (
                <Focusable
                  as={motion.div}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="group cursor-pointer flex flex-col items-center gap-4 outline-none"
                  onClick={() => setIsAdding(true)}
                  activeClassName="ring-4 ring-primary rounded-xl scale-110"
                >
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-white/5 border-2 border-white/20 group-hover:border-white flex items-center justify-center transition-all shadow-2xl">
                    <Plus size={48} className="text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-gray-400 text-xl font-medium group-hover:text-white transition-colors">
                    Add Profile
                  </span>
                </Focusable>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="adding"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl z-10"
          >
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-white">Add Profile</h2>
                <Focusable 
                  as="button"
                  onClick={() => setIsAdding(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors outline-none"
                  activeClassName="ring-2 ring-primary bg-primary"
                >
                  <X size={24} />
                </Focusable>
              </div>

              <form onSubmit={handleAddProfile} className="space-y-8">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="space-y-4">
                    <label className="text-sm font-medium text-gray-400 block">Choose Avatar</label>
                    <div className="grid grid-cols-4 gap-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide p-1">
                      {AVATARS.map((avatar) => (
                        <Focusable
                          as="div"
                          key={avatar.id}
                          onClick={() => setSelectedAvatar(avatar.id)}
                          className={`
                            relative cursor-pointer rounded-full overflow-hidden transition-all duration-300 outline-none
                            ${selectedAvatar === avatar.id ? 'ring-4 ring-primary scale-110 z-10' : 'ring-2 ring-transparent opacity-70 hover:opacity-100 hover:scale-105'}
                          `}
                          activeClassName="ring-4 ring-white scale-125 z-20"
                        >
                          <div className="aspect-square bg-linear-to-br from-gray-800 to-gray-900">
                             <Avatar id={avatar.id} />
                          </div>
                          {selectedAvatar === avatar.id && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="text-white drop-shadow-md" size={24} />
                            </div>
                          )}
                        </Focusable>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 space-y-6 w-full">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-400">Profile Name</label>
                      <Focusable
                        as="input"
                        type="text"
                        value={newProfileName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProfileName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-transparent transition-all text-lg"
                        placeholder="Enter name"
                        autoFocus
                        activeClassName="ring-2 ring-primary bg-black/60"
                      />
                    </div>

                    <div className="pt-4">
                      <Focusable
                        as="button"
                        type="submit"
                        disabled={!newProfileName.trim()}
                        className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed text-lg outline-none"
                        activeClassName="ring-4 ring-white scale-105"
                      >
                        Create Profile
                      </Focusable>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileSelection;
