import React, { useState } from 'react';
import { 
  Palette, 
  Monitor, 
  User, 
  Database, 
  ChevronRight, 
  Type, 
  Trash2, 
  RefreshCw,
  Globe,
  Check,
  Shield,
  FileText,
  Lock,
  Sparkles,
  Download,
  Server
} from 'lucide-react';
import { db } from '../db';
import { CleanupAgent } from '../services/CleanupAgent';
import { useSettings, Settings as AppSettings } from '../context/SettingsContext';
import { useAuth } from '../context/useAuth';
import { Avatar } from '../components/Avatars';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  checkForUpdates, 
  downloadUpdate, 
  installUpdate, 
  onUpdateProgress, 
  onUpdateDownloaded 
} from '../services/updateService';
import pkg from '../../package.json';
import { AppVersion } from '../types';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'player' | 'account' | 'storage' | 'privacy' | 'system'>('appearance');
  const navigate = useNavigate();
  const { user, profile: authProfile } = useAuth();
  
  const [updateAvailable, setUpdateAvailable] = useState<AppVersion | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'ready' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    setErrorMessage('');
    try {
      const update = await checkForUpdates(pkg.version);
      if (update) {
        setUpdateAvailable(update);
        setUpdateStatus('available');
      } else {
        setUpdateStatus('up-to-date');
      }
    } catch (error) {
      // console.error('Update check failed:', error);
      const err = error as Error;
      // Handle the specific "Cannot find latest-mac.yml" or 404 as "Up to date"
      if (err?.message?.includes('404') || err?.message?.includes('Cannot find latest')) {
         setUpdateStatus('up-to-date');
         return;
      }
      setUpdateStatus('error');
      setErrorMessage('Failed to check for updates. Please try again.');
    }
  };

  const handleDownloadUpdate = async () => {
    if (!updateAvailable) return;
    try {
      setUpdateStatus('downloading');
      
      // Setup listeners
      const cleanupProgress = onUpdateProgress((p) => {
        setDownloadProgress(p.percent);
      });
      
      const cleanupDownloaded = onUpdateDownloaded(() => {
        setUpdateStatus('ready');
        cleanupProgress();
        cleanupDownloaded();
      });

      await downloadUpdate();
    } catch (error) {
      // console.error('Download failed:', error);
      setUpdateStatus('error');
      setErrorMessage('Failed to download update.');
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await installUpdate();
    } catch (error) {
      // console.error('Install failed:', error);
      setUpdateStatus('error');
      setErrorMessage('Failed to restart and install.');
    }
  };

  
  const { 
    themeColor, 
    subtitleSize, 
    subtitleColor, 
    autoplay, 
    reducedMotion,
    defaultLanguage,
    updateSettings
  } = useSettings();

  const colors = [
    { name: 'Violet', value: '#7c3aed' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Blue', value: '#3b82f6' },
  ];

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear your watch history?')) {
      await db.history.clear();
      alert('History cleared successfully!');
    }
  };

  const handleClearCache = () => {
    if (confirm('This will clear app cache and reset all settings. Continue?')) {
      localStorage.clear();
      alert('App cache cleared. Settings have been reset.');
      window.location.reload();
    }
  };

  const handleCleanup = async () => {
    if (confirm('This will remove items with missing or broken images from your Library and History. Continue?')) {
      const report = await CleanupAgent.runCleanup();
      if (report.errors.length > 0) {
        alert(`Cleanup completed with errors: ${report.errors.join(', ')}`);
      } else {
        alert(`Cleanup complete!
Removed ${report.libraryRemoved} items from Library
Removed ${report.historyRemoved} items from History
Removed ${report.episodeProgressRemoved} duplicate progress items
Removed ${report.sourceMemoryRemoved} duplicate source items`);
      }
    }
  };

  const TabButton = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: React.ElementType, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
        activeTab === id 
          ? 'bg-primary text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]' 
          : 'text-textSecondary hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
      {activeTab === id && <ChevronRight size={16} className="ml-auto" />}
    </button>
  );

  return (
    <div className="h-full pt-24 px-10 pb-10 overflow-hidden flex flex-col">
      <h1 className="text-4xl font-black mb-8 bg-linear-to-r from-white to-white/50 bg-clip-text text-transparent">
        Settings
      </h1>

      <div className="flex flex-1 gap-8 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-64 space-y-2 shrink-0">
          <TabButton id="appearance" icon={Palette} label="Appearance" />
          <TabButton id="player" icon={Monitor} label="Player & Playback" />
          <TabButton id="account" icon={User} label="Account" />
          <TabButton id="storage" icon={Database} label="Storage & Data" />
          <TabButton id="privacy" icon={Shield} label="Privacy & Terms" />
          <TabButton id="system" icon={Server} label="System & Updates" />
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-surface/50 backdrop-blur-md border border-white/5 rounded-3xl p-8 overflow-y-auto">
          
          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <Palette className="text-primary" /> Accent Color
                </h2>
                <div className="grid grid-cols-5 gap-4">
                  {colors.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => updateSettings({ themeColor: color.value })}
                      className="group relative h-16 rounded-2xl transition-all hover:scale-105 ring-2 ring-transparent hover:ring-white/20"
                      style={{ backgroundColor: color.value }}
                    >
                      {themeColor === color.value && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="text-white drop-shadow-md" size={24} />
                        </div>
                      )}
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {color.name}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <div className="w-full h-px bg-white/5" />

              <section>
                <h2 className="text-2xl font-bold mb-4">Accessibility</h2>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                  <div>
                    <h3 className="font-bold">Reduced Motion</h3>
                    <p className="text-sm text-gray-400">Minimize animations across the app</p>
                  </div>
                  <button 
                    onClick={() => updateSettings({ reducedMotion: !reducedMotion })}
                    className={`w-14 h-8 rounded-full transition-colors relative ${reducedMotion ? 'bg-primary' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${reducedMotion ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* Player Tab */}
          {activeTab === 'player' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Type className="text-primary" /> Subtitles & Captions
                </h2>
                
                <div className="bg-black/40 rounded-2xl p-6 border border-white/5 mb-6">
                  <div className="text-center mb-6">
                    <span 
                      className="px-4 py-2 rounded transition-all duration-300"
                      style={{ 
                        fontSize: subtitleSize === 'small' ? '14px' : subtitleSize === 'large' ? '24px' : '18px',
                        color: subtitleColor,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        fontFamily: 'sans-serif'
                      }}
                    >
                      This is how your subtitles will look.
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-2">Size</label>
                      <div className="flex bg-white/5 rounded-lg p-1">
                        {['small', 'medium', 'large'].map((s) => (
                          <button
                            key={s}
                            onClick={() => updateSettings({ subtitleSize: s as AppSettings['subtitleSize'] })}
                            className={`flex-1 py-2 rounded-md text-sm font-medium capitalize transition-all ${
                              subtitleSize === s ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-2">Color</label>
                      <div className="flex gap-2">
                        {['white', 'yellow', 'cyan'].map((c) => (
                          <button
                            key={c}
                            onClick={() => updateSettings({ subtitleColor: c as AppSettings['subtitleColor'] })}
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                              subtitleColor === c ? 'border-primary scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                   <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <Globe className="text-gray-400" size={20} />
                      <div>
                        <h3 className="font-bold">Default Audio Language</h3>
                        <p className="text-sm text-gray-400">Preferred audio track language</p>
                      </div>
                    </div>
                    <select 
                      value={defaultLanguage}
                      onChange={(e) => updateSettings({ defaultLanguage: e.target.value })}
                      className="bg-black/50 border border-white/10 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-primary"
                    >
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                      <option>Japanese</option>
                    </select>
                  </div>
                </div>
              </section>

              <div className="w-full h-px bg-white/5" />

              <section>
                <h2 className="text-2xl font-bold mb-4">Playback Behavior</h2>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                  <div>
                    <h3 className="font-bold">Auto-Play Next Episode</h3>
                    <p className="text-sm text-gray-400">Automatically play the next episode when one finishes</p>
                  </div>
                  <button 
                    onClick={() => updateSettings({ autoplay: !autoplay })}
                    className={`w-14 h-8 rounded-full transition-colors relative ${autoplay ? 'bg-primary' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${autoplay ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center gap-6 p-6 bg-linear-to-br from-primary/20 to-purple-900/20 rounded-2xl border border-primary/20">
                 <div className="w-24 h-24 rounded-full bg-linear-to-br from-primary to-purple-600 p-1 flex items-center justify-center text-3xl font-bold shadow-2xl ring-4 ring-white/5 overflow-hidden">
                   <Avatar id={authProfile?.avatarId || 'human-m-1'} />
                 </div>
                 <div>
                   <h2 className="text-3xl font-bold">{authProfile?.name || 'Guest'}</h2>
                   <p className="text-primary/80 font-medium">Premium Member</p>
                   <p className="text-gray-400 text-sm mt-1">
                     Member since {user?.createdAt ? new Date(user.createdAt).getFullYear() : new Date().getFullYear()}
                   </p>
                 </div>
                 <button 
                   onClick={() => navigate('/profile')}
                   className="ml-auto bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl font-medium transition-colors"
                 >
                   Edit Profile
                 </button>
               </div>

               <div className="grid grid-cols-2 gap-6">
                 <div className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                   <h3 className="font-bold text-gray-400 mb-1">Email</h3>
                   <p className="text-lg font-medium">{user?.email || 'Not signed in'}</p>
                 </div>
                 <div className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                   <h3 className="font-bold text-gray-400 mb-1">Plan</h3>
                   <div className="flex items-center justify-between">
                     <p className="text-lg font-medium">Ultra HD (4K)</p>
                     <span className="text-primary text-sm font-bold cursor-pointer hover:underline">Manage</span>
                   </div>
                 </div>
               </div>
            </div>
          )}

          {/* Storage Tab */}
          {activeTab === 'storage' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Database className="text-primary" /> Data Management
                </h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-xl border border-white/5 group hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/5 rounded-lg group-hover:bg-red-500/20 transition-colors">
                        <RefreshCw className="text-white group-hover:text-red-400" size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold group-hover:text-red-400 transition-colors">Clear Watch History</h3>
                        <p className="text-sm text-gray-400">Remove all progress and continue watching items</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleClearHistory}
                      className="px-4 py-2 bg-white/5 hover:bg-red-500 hover:text-white rounded-lg text-sm font-medium transition-all"
                    >
                      Clear History
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-xl border border-white/5 group hover:bg-orange-500/10 hover:border-orange-500/20 transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/5 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                        <Trash2 className="text-white group-hover:text-orange-400" size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold group-hover:text-orange-400 transition-colors">Clear App Cache</h3>
                        <p className="text-sm text-gray-400">Fix playback issues by resetting local cache</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleClearCache}
                      className="px-4 py-2 bg-white/5 hover:bg-orange-500 hover:text-white rounded-lg text-sm font-medium transition-all"
                    >
                      Clear Cache
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-white/5 rounded-xl border border-white/5 group hover:bg-purple-500/10 hover:border-purple-500/20 transition-all duration-300">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white/5 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                        <Sparkles className="text-white group-hover:text-purple-400" size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold group-hover:text-purple-400 transition-colors">Cleanup Broken Items</h3>
                        <p className="text-sm text-gray-400">Remove items with missing images or invalid data</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleCleanup}
                      className="px-4 py-2 bg-white/5 hover:bg-purple-500 hover:text-white rounded-lg text-sm font-medium transition-all"
                    >
                      Run Cleanup
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Privacy & Terms Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Header Card */}
              <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-primary/20 via-purple-900/10 to-black border border-white/10 p-8">
                <div className="absolute top-0 right-0 p-8 opacity-20">
                  <Shield size={120} className="text-primary rotate-12" />
                </div>
                <div className="relative z-10">
                  <h2 className="text-3xl font-black mb-2 text-white">Legal Center</h2>
                  <p className="text-gray-300 max-w-lg text-lg">
                    Transparency is our core value. Here's how we handle your data and the rules that govern our service.
                  </p>
                  <div className="mt-6 flex gap-3">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider">
                      <Check size={12} strokeWidth={3} />
                      <span>GDPR Compliant</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
                      <Lock size={12} strokeWidth={3} />
                      <span>End-to-End Encrypted</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6">
                {/* Privacy Policy Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.1)]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-primary/20 text-primary group-hover:scale-110 transition-transform duration-300">
                      <Lock size={24} />
                    </div>
                    <span className="text-xs font-medium text-gray-500 bg-black/30 px-2 py-1 rounded">Last updated: Jan 2026</span>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2 text-white group-hover:text-primary transition-colors">Privacy Policy</h3>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                    We collect minimal data necessary for synchronization across devices. Your watch history is stored locally first and encrypted when synced. We do not sell your personal data to third parties.
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span>Local-first architecture</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span>No third-party tracking cookies</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span>Data deletion available anytime</span>
                    </div>
                  </div>

                  <button className="mt-6 w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-sm font-bold transition-all flex items-center justify-center gap-2 group-hover:text-white">
                    Read Full Policy <ChevronRight size={16} />
                  </button>
                </motion.div>

                {/* Terms of Service Card */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.1)]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-xl bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform duration-300">
                      <FileText size={24} />
                    </div>
                    <span className="text-xs font-medium text-gray-500 bg-black/30 px-2 py-1 rounded">Version 2.1</span>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-2 text-white group-hover:text-blue-400 transition-colors">Terms of Service</h3>
                  <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                    By using Influcine, you agree to fair usage policies. This app is a content aggregator and does not host copyrighted files directly. Users are responsible for their content consumption sources.
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span>Fair usage policy</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span>Content aggregation disclaimer</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span>Community guidelines</span>
                    </div>
                  </div>

                  <button className="mt-6 w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-sm font-bold transition-all flex items-center justify-center gap-2 group-hover:text-white">
                    Read Terms of Service <ChevronRight size={16} />
                  </button>
                </motion.div>
              </div>

              {/* Contact / Support Footer */}
              <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
                <p>Questions about legal? <span className="text-primary cursor-pointer hover:underline">Contact Legal Team</span></p>
              </div>
            </div>
          )}

          {/* System & Updates Tab */}
          {activeTab === 'system' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Server className="text-primary" /> System Status
                </h2>
                
                <div className="bg-linear-to-br from-white/5 to-white/0 rounded-2xl p-8 border border-white/10 relative overflow-hidden">
                  {/* Background Glow */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-8">
                      <div>
                        <h3 className="text-3xl font-black text-white mb-2">Influcine Desktop</h3>
                        <p className="text-gray-400 font-medium">Version {pkg.version}</p>
                        <div className="flex items-center gap-2 mt-4">
                          <span className={`w-2 h-2 rounded-full ${updateStatus === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
                          <span className="text-sm text-gray-400">
                            {updateStatus === 'checking' ? 'Checking for updates...' : 
                             updateStatus === 'available' ? 'Update Available' : 
                             updateStatus === 'downloading' ? 'Downloading Update...' :
                             updateStatus === 'ready' ? 'Ready to Install' :
                             updateStatus === 'error' ? 'Update Error' :
                             'System Operational'}
                          </span>
                        </div>
                      </div>
                      
                      {updateStatus === 'idle' || updateStatus === 'up-to-date' || updateStatus === 'error' || updateStatus === 'checking' ? (
                        <button 
                          onClick={handleCheckUpdate}
                          disabled={updateStatus === 'checking'}
                          className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          <RefreshCw size={20} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
                          {updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}
                        </button>
                      ) : null}
                    </div>

                    {errorMessage && (
                       <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-sm font-medium flex items-center gap-3">
                         <Shield size={18} />
                         {errorMessage}
                       </div>
                    )}

                    {updateAvailable && (
                      <div className="bg-black/30 rounded-xl p-6 border border-white/5 backdrop-blur-sm">
                        <div className="flex items-start justify-between mb-4">
                           <div>
                             <h4 className="text-xl font-bold text-white mb-1">New Version Available</h4>
                             <p className="text-primary font-bold text-lg">v{updateAvailable.latest}</p>
                           </div>
                           {updateStatus === 'available' && (
                             <button 
                               onClick={handleDownloadUpdate}
                               className="px-6 py-2 bg-primary hover:bg-primary-dark rounded-lg font-bold transition-all shadow-lg shadow-primary/25 flex items-center gap-2"
                             >
                               <Download size={18} />
                               Download Update
                             </button>
                           )}
                        </div>
                        
                        <div className="prose prose-invert max-w-none mb-6">
                          <p className="text-gray-300 text-sm whitespace-pre-line bg-white/5 p-4 rounded-lg border border-white/5">
                            {updateAvailable.releaseNotes || 'No release notes available.'}
                          </p>
                        </div>

                        {updateStatus === 'downloading' && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm text-gray-400">
                              <span>Downloading...</span>
                              <span>{Math.round(downloadProgress)}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${downloadProgress}%` }}
                                className="h-full bg-primary"
                              />
                            </div>
                          </div>
                        )}

                        {updateStatus === 'ready' && (
                           <button 
                             onClick={handleInstallUpdate}
                             className="w-full py-4 bg-green-500 hover:bg-green-600 rounded-xl font-bold text-white transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 animate-pulse"
                           >
                             <Sparkles size={20} />
                             Restart & Install Update
                           </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Settings;
