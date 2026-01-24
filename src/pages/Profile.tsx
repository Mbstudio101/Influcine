import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/useAuth';
import { AVATARS, Avatar } from '../components/Avatars';
import { Edit2, Check, X, Mail, Key, LogOut, Users, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db, Achievement } from '../db';
import { LevelProgress } from '../components/Achievements/LevelProgress';
import { AchievementGrid } from '../components/Achievements/AchievementGrid';

const Profile: React.FC = () => {
  const { profile, updateProfile, user, updateUser, logout } = useAuth();
  const { themeColor } = useSettings();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(profile?.name || '');
  const [tempAvatar, setTempAvatar] = useState(profile?.avatarId || AVATARS[0].id);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState(user?.email || '');
  const [emailError, setEmailError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    if (profile) {
      setTempName(profile.name);
      setTempAvatar(profile.avatarId);
      
      // Load achievements
      db.achievements.where('profileId').equals(profile.id!).toArray().then(setAchievements);
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      setTempEmail(user.email);
    }
  }, [user]);

  const handleSave = async () => {
    if (profile && profile.id) {
      await updateProfile(profile.id, { name: tempName, avatarId: tempAvatar });
      setIsEditing(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!tempEmail.includes('@')) {
      setEmailError('Invalid email address');
      return;
    }
    try {
      await updateUser({ email: tempEmail });
      setIsEditingEmail(false);
      setEmailError('');
    } catch (error: unknown) {
      if (error instanceof Error) {
        setEmailError(error.message);
      } else {
        setEmailError('Failed to update email');
      }
    }
  };

  const handleCancel = () => {
    if (profile) {
      setTempName(profile.name);
      setTempAvatar(profile.avatarId);
    }
    setIsEditing(false);
  };

  const handlePasswordReset = () => {
    setResetSent(true);
    setTimeout(() => setResetSent(false), 3000);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!profile) return null;

  return (
    <div className="h-full pt-24 pb-20 px-6 md:px-12 overflow-y-auto scrollbar-hide relative">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]" style={{ backgroundColor: themeColor, opacity: 0.2 }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px]" style={{ opacity: 0.2 }} />
      </div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-8">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row items-start gap-8 md:gap-12">
            {/* Avatar Section */}
            <div className="relative group mx-auto md:mx-0">
              <div className="w-40 h-40 md:w-56 md:h-56 rounded-full p-2 bg-linear-to-br from-white/10 to-transparent border border-white/20 shadow-xl overflow-hidden relative">
                 <div className="w-full h-full rounded-full overflow-hidden bg-black/20">
                    <Avatar id={isEditing ? tempAvatar : profile.avatarId} />
                 </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="flex-1 text-center md:text-left space-y-4 w-full">
              <div className="flex items-center justify-center md:justify-between mb-2">
                <h1 className="text-sm font-bold text-primary tracking-widest uppercase">Profile</h1>
                {!isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-medium transition-all"
                  >
                    <Edit2 size={14} /> Edit Profile
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Display Name</label>
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-2xl font-bold text-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-4 uppercase tracking-wider">Select Avatar</label>
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
                      {AVATARS.map((avatar) => (
                        <button
                          key={avatar.id}
                          onClick={() => setTempAvatar(avatar.id)}
                          className={`relative rounded-full p-1 transition-all duration-300 ${tempAvatar === avatar.id ? 'scale-110 ring-2 ring-primary bg-white/10' : 'hover:scale-105 opacity-70 hover:opacity-100'}`}
                        >
                          <Avatar id={avatar.id} />
                          {tempAvatar === avatar.id && (
                            <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1 rounded-full shadow-lg">
                              <Check size={10} strokeWidth={4} />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button 
                      onClick={handleSave}
                      className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-primary/25 flex items-center justify-center gap-2"
                    >
                      <Check size={18} /> Save Changes
                    </button>
                    <button 
                      onClick={handleCancel}
                      className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-4xl md:text-5xl font-bold text-white mb-2">{profile.name}</h2>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-8 pt-4">
                     <div className="text-center md:text-left">
                        <div className="text-2xl font-bold text-white">0</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Hours Watched</div>
                     </div>
                     <div className="w-px h-10 bg-white/10"></div>
                     <div className="text-center md:text-left">
                        <div className="text-2xl font-bold text-white">0</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Movies</div>
                     </div>
                     <div className="w-px h-10 bg-white/10"></div>
                     <div className="text-center md:text-left">
                        <div className="text-2xl font-bold text-white">0</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Series</div>
                     </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* XP & Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-6"
        >
          <LevelProgress 
            level={profile.stats?.level || 1} 
            currentXP={profile.stats?.totalXP || 0} 
          />
          
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
             <AchievementGrid userAchievements={achievements} />
          </div>
        </motion.div>

        {/* Account Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/20 rounded-lg text-primary">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-bold text-white">Account Settings</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={16} /> Email Address
                </div>
                {!isEditingEmail && (
                  <button 
                    onClick={() => setIsEditingEmail(true)}
                    className="text-xs text-primary hover:text-white transition-colors"
                  >
                    Change
                  </button>
                )}
              </label>
              
              {isEditingEmail ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={tempEmail}
                      onChange={(e) => {
                        setTempEmail(e.target.value);
                        setEmailError('');
                      }}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                    />
                    <button 
                      onClick={handleSaveEmail}
                      className="bg-primary hover:bg-primary-hover text-white px-4 rounded-xl transition-colors"
                    >
                      <Check size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditingEmail(false);
                        setTempEmail(user?.email || '');
                        setEmailError('');
                      }}
                      className="bg-white/10 hover:bg-white/20 text-white px-4 rounded-xl transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {emailError && <p className="text-xs text-red-500">{emailError}</p>}
                </div>
              ) : (
                <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white flex items-center justify-between">
                  <span>{user?.email}</span>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Verified</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
               <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Key size={16} /> Password
              </label>
              <button 
                onClick={handlePasswordReset}
                disabled={resetSent}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white transition-all text-left flex items-center justify-between group"
              >
                <span>{resetSent ? 'Reset Link Sent' : 'Reset Password'}</span>
                {resetSent ? <Check size={16} className="text-green-400" /> : <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">Send Link</span>}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Session Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => navigate('/profiles')}
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 text-white font-medium transition-all flex items-center justify-center gap-2"
          >
            <Users size={20} /> Switch Profile
          </button>
          <button 
            onClick={handleLogout}
            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl p-4 text-red-500 font-medium transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={20} /> Log Out
          </button>
        </div>

      </div>
    </div>
  );
};

export default Profile;
