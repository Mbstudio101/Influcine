import React from 'react';
import { 
  Sparkles, Check, Volume2, Type, Gauge, X, Globe 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SubtitleFile } from '../../hooks/usePlayerSubtitles';

// Define types for tracks since they might not be globally available
interface ExtendedAudioTrack {
    id?: string;
    label: string;
    language: string;
    kind: string;
    enabled: boolean;
}

interface PlayerSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  
  // Tabs
  activeTab: 'speed' | 'audio' | 'subtitles' | 'source';
  setActiveTab: (tab: 'speed' | 'audio' | 'subtitles' | 'source') => void;
  
  // Speed
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  
  // Audio
  audioMode: 'cinema' | 'standard';
  onAudioModeChange: (mode: 'cinema' | 'standard') => void;
  audioFormat: string;
  availableTracks: ExtendedAudioTrack[];
  onTrackChange: (track: ExtendedAudioTrack) => void;
  
  // Subtitles
  availableSubtitles: TextTrack[];
  externalSubtitles: SubtitleFile[];
  activeSubtitleIndex: number;
  onSubtitleChange: (index: number) => void;
  
  embedTracks: {index: number, label: string, language: string}[];
  activeEmbedTrackIndex: number;
  onEmbedTrackChange: (index: number) => void;
  
  autoSubtitles: any[];
  activeAutoSubtitleIndex: number;
  onAutoSubtitleChange: (index: number) => void;
  
  isSearchingSubs: boolean;
  onUploadClick: () => void;
  onSearchOnline: () => void;
  
  provider?: string;
  onProviderChange?: (provider: string) => void;
  isNativeMode?: boolean;
  onToggleNativeMode?: () => void;
}

export const PlayerSettings: React.FC<PlayerSettingsProps> = ({
  isOpen, onClose,
  activeTab, setActiveTab,
  playbackSpeed, onSpeedChange,
  audioMode, onAudioModeChange, audioFormat,
  availableTracks, onTrackChange,
  availableSubtitles, externalSubtitles, activeSubtitleIndex, onSubtitleChange,
  embedTracks, activeEmbedTrackIndex, onEmbedTrackChange,
  autoSubtitles, activeAutoSubtitleIndex, onAutoSubtitleChange,
  isSearchingSubs, onUploadClick, onSearchOnline,
  provider, onProviderChange,
  isNativeMode, onToggleNativeMode
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="absolute top-0 right-0 h-full w-80 bg-black/95 backdrop-blur-xl border-l border-white/10 z-50 overflow-hidden flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold text-white">Settings</h2>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }} 
              className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button 
              onClick={() => setActiveTab('audio')}
              className={`flex-1 p-3 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${activeTab === 'audio' ? 'text-blue-400 bg-white/5' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              <Volume2 className="w-5 h-5" />
              Audio
            </button>
            <button 
              onClick={() => setActiveTab('subtitles')}
              className={`flex-1 p-3 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${activeTab === 'subtitles' ? 'text-blue-400 bg-white/5' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              <Type className="w-5 h-5" />
              Subtitles
            </button>
            <button 
              onClick={() => setActiveTab('speed')}
              className={`flex-1 p-3 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${activeTab === 'speed' ? 'text-blue-400 bg-white/5' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              <Gauge className="w-5 h-5" />
              Speed
            </button>
            <button 
              onClick={() => setActiveTab('source')}
              className={`flex-1 p-3 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${activeTab === 'source' ? 'text-blue-400 bg-white/5' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              <Globe className="w-5 h-5" />
              Source
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {activeTab === 'source' && (
              <div className="space-y-4">
                {onToggleNativeMode && (
                  <button
                    onClick={onToggleNativeMode}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all mb-4 ${isNativeMode ? 'bg-red-500/20 border-red-500/50 text-white' : 'bg-white/5 border-transparent text-white/70 hover:bg-white/10'}`}
                  >
                     <div className="text-left">
                       <div className="font-medium">{isNativeMode ? 'Disable Native Mode' : 'Enable Native Mode'}</div>
                       <div className="text-xs opacity-60">Use the embedded player's original controls</div>
                     </div>
                     {isNativeMode && <Check className="w-5 h-5 text-red-400" />}
                  </button>
                )}

                <div className="text-xs text-white/50 px-1">
                  If the current video is not loading, buffering, or incorrect, try switching to a different source provider.
                </div>
                
                {[
                  { id: 'vidfast', name: 'VidFast', desc: 'Fastest, No Ads (Default)' },
                  { id: 'vidlink', name: 'VidLink', desc: 'High Quality, Multi-Server' },
                  { id: 'vidsrc', name: 'VidSrc', desc: 'Reliable Backup' },
                  { id: 'superembed', name: 'SuperEmbed', desc: 'Aggregator' },
                  { id: '2embed', name: '2Embed', desc: 'Alternative' },
                ].map(p => (
                    <button
                        key={p.id}
                        onClick={() => onProviderChange?.(p.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${provider === p.id ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-white/5 border-transparent text-white/70 hover:bg-white/10'}`}
                    >
                        <div className="text-left">
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs opacity-60">{p.desc}</div>
                        </div>
                        {provider === p.id && <Check className="w-5 h-5 text-blue-400" />}
                    </button>
                ))}
              </div>
            )}

            {activeTab === 'speed' && (
              <div className="space-y-1">
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(speed => (
                  <button
                    key={speed}
                    onClick={() => onSpeedChange(speed)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-colors ${playbackSpeed === speed ? 'bg-white/10 text-blue-400' : 'text-white/80'}`}
                  >
                    <span>{speed}x</span>
                    {playbackSpeed === speed && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-6">
                {/* Cinema Audio Toggle */}
                <div className="bg-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Influcine Audio Engine</span>
                  </div>
                  
                  <button
                    onClick={() => onAudioModeChange('cinema')}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${audioMode === 'cinema' ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-black/20 border-white/10 text-white/60 hover:border-white/30'}`}
                  >
                    <div className="text-left">
                      <div className="font-medium">Cinema Mode</div>
                      <div className="text-xs opacity-70">Dynamic Range Compression & Normalization</div>
                    </div>
                    {audioMode === 'cinema' && <Check className="w-5 h-5 text-blue-400" />}
                  </button>

                  <button
                    onClick={() => onAudioModeChange('standard')}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${audioMode === 'standard' ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-black/20 border-white/10 text-white/60 hover:border-white/30'}`}
                  >
                    <div className="text-left">
                      <div className="font-medium">Standard</div>
                      <div className="text-xs opacity-70">Original Mix (Passthrough)</div>
                    </div>
                    {audioMode === 'standard' && <Check className="w-5 h-5 text-blue-400" />}
                  </button>

                  <div className="pt-2 border-t border-white/10">
                    <div className="flex justify-between text-xs text-white/40">
                      <span>Detected Format:</span>
                      <span className="text-white/60 font-mono">{audioFormat}</span>
                    </div>
                  </div>
                </div>

                {/* Audio Tracks */}
                {availableTracks.length > 0 && (
                   <div className="space-y-2">
                     <h3 className="text-xs font-bold uppercase text-white/40 tracking-wider px-1">Source Tracks</h3>
                     {availableTracks.map((track, i) => (
                       <button
                         key={i}
                         onClick={() => onTrackChange(track)}
                         className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-colors ${track.enabled ? 'bg-white/10 text-blue-400' : 'text-white/80'}`}
                       >
                         <div className="text-left">
                           <div>{track.label || `Track ${i + 1}`}</div>
                           <div className="text-xs opacity-60 uppercase">{track.language}</div>
                         </div>
                         {track.enabled && <Check className="w-4 h-4" />}
                       </button>
                     ))}
                   </div>
                )}
              </div>
            )}

            {activeTab === 'subtitles' && (
              <div className="space-y-6">
                <div className="flex gap-2 mb-4">
                  <button 
                    onClick={onUploadClick}
                    className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white transition-colors"
                  >
                    Upload .SRT/VTT
                  </button>
                  <button 
                    onClick={onSearchOnline}
                    className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white transition-colors"
                  >
                    Search Online
                  </button>
                </div>

                {isSearchingSubs && (
                    <div className="text-center py-4 text-white/50 text-sm animate-pulse">
                        Searching best subtitles...
                    </div>
                )}

                <div className="space-y-1">
                  <button
                    onClick={() => {
                        onSubtitleChange(-1);
                        onEmbedTrackChange(-1);
                        onAutoSubtitleChange(-1);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-colors ${activeSubtitleIndex === -1 && activeEmbedTrackIndex === -1 && activeAutoSubtitleIndex === -1 ? 'bg-white/10 text-blue-400' : 'text-white/80'}`}
                  >
                    <span>Off</span>
                    {activeSubtitleIndex === -1 && activeEmbedTrackIndex === -1 && activeAutoSubtitleIndex === -1 && <Check className="w-4 h-4" />}
                  </button>

                  {/* Auto-Fetched Subs */}
                  {autoSubtitles.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-bold text-blue-400 uppercase tracking-wider mt-4">Auto-Matched</div>
                        {autoSubtitles.map((sub, i) => (
                            <button
                                key={`auto-${i}`}
                                onClick={() => onAutoSubtitleChange(i)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-colors ${activeAutoSubtitleIndex === i ? 'bg-white/10 text-blue-400' : 'text-white/80'}`}
                            >
                                <span className="truncate pr-2">{sub.label}</span>
                                {activeAutoSubtitleIndex === i && <Check className="w-4 h-4 flex-shrink-0" />}
                            </button>
                        ))}
                      </>
                  )}

                  {/* Embed Tracks */}
                  {embedTracks.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-bold text-white/40 uppercase tracking-wider mt-4">Source Tracks</div>
                        {embedTracks.map((track) => (
                            <button
                                key={`embed-${track.index}`}
                                onClick={() => onEmbedTrackChange(track.index)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-colors ${activeEmbedTrackIndex === track.index ? 'bg-white/10 text-blue-400' : 'text-white/80'}`}
                            >
                                <span>{track.label}</span>
                                {activeEmbedTrackIndex === track.index && <Check className="w-4 h-4" />}
                            </button>
                        ))}
                      </>
                  )}

                  {/* External/Native Tracks */}
                  {(availableSubtitles.length > 0 || externalSubtitles.length > 0) && (
                      <>
                        <div className="px-2 py-1 text-xs font-bold text-white/40 uppercase tracking-wider mt-4">Native Tracks</div>
                        {externalSubtitles.map((sub, i) => {
                            // Virtual index for external subs
                            const virtIndex = availableSubtitles.length + i; 
                            return (
                                <button
                                    key={`ext-${i}`}
                                    onClick={() => onSubtitleChange(virtIndex)}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-colors ${activeSubtitleIndex === virtIndex ? 'bg-white/10 text-blue-400' : 'text-white/80'}`}
                                >
                                    <span>{sub.label}</span>
                                    {activeSubtitleIndex === virtIndex && <Check className="w-4 h-4" />}
                                </button>
                            );
                        })}
                        
                        {Array.from(availableSubtitles).map((track, i) => (
                            <button
                            key={i}
                            onClick={() => onSubtitleChange(i)}
                            className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/10 transition-colors ${activeSubtitleIndex === i ? 'bg-white/10 text-blue-400' : 'text-white/80'}`}
                            >
                            <span>{track.label || `Track ${i + 1}`}</span>
                            {activeSubtitleIndex === i && <Check className="w-4 h-4" />}
                            </button>
                        ))}
                      </>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
