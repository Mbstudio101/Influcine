import { useEffect, useRef, useState, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';

export interface ExtendedAudioTrack {
  id?: string;
  label: string;
  language: string;
  kind: string;
  enabled: boolean;
}

export interface ExtendedAudioTrackList {
  length: number;
  [index: number]: ExtendedAudioTrack;
}

// Global cache to prevent re-creating source nodes for the same video element
const sourceNodeCache = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

export function usePlayerAudio(
  videoRef: React.RefObject<HTMLVideoElement>,
  isEmbed: boolean,
  src: string | undefined
) {
  const [audioMode, setAudioMode] = useState<'cinema' | 'standard'>('cinema');
  const [audioFormat, setAudioFormat] = useState<string>('Optimized Stereo');
  const [audioEngineReady, setAudioEngineReady] = useState(false);
  const [availableTracks, setAvailableTracks] = useState<ExtendedAudioTrack[]>([]);
  const { audio } = useSettings();
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const pannerRef = useRef<PannerNode | null>(null);

  // Initialize Audio Context and Graph
  useEffect(() => {
    if (isEmbed || !videoRef.current || !src) return;
    
    try {
      // 1. Initialize Context
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;

      // 2. Initialize Source
      if (!sourceNodeRef.current) {
        if (sourceNodeCache.has(videoRef.current)) {
          sourceNodeRef.current = sourceNodeCache.get(videoRef.current)!;
        } else {
          try {
            const source = ctx.createMediaElementSource(videoRef.current);
            sourceNodeCache.set(videoRef.current, source);
            sourceNodeRef.current = source;
          } catch (e) {
            // If creation fails, it might be because it was already created but not in our cache (unlikely if we use a global cache)
            // or another error. We can't recover easily if we can't get the source.
            // console.error("Failed to create MediaElementSource", e);
            throw e;
          }
        }
      }

      // 3. Initialize Nodes
      if (!gainNodeRef.current) {
        gainNodeRef.current = ctx.createGain();
        gainNodeRef.current.gain.value = 1.0;
      }

      if (!analyserNodeRef.current) {
        analyserNodeRef.current = ctx.createAnalyser();
        analyserNodeRef.current.fftSize = 2048;
      }

      if (!compressorRef.current) {
        compressorRef.current = ctx.createDynamicsCompressor();
        // Configure Compressor for "Cinema Audio"
        compressorRef.current.threshold.value = -24;
        compressorRef.current.knee.value = 30;
        compressorRef.current.ratio.value = 12;
        compressorRef.current.attack.value = 0.003;
        compressorRef.current.release.value = 0.25;
      }

      if (!pannerRef.current) {
        pannerRef.current = ctx.createPanner();
        pannerRef.current.panningModel = 'HRTF';
        pannerRef.current.distanceModel = 'inverse';
        pannerRef.current.refDistance = 1;
        pannerRef.current.maxDistance = 10000;
        pannerRef.current.rolloffFactor = 1;
        pannerRef.current.coneInnerAngle = 360;
        pannerRef.current.coneOuterAngle = 0;
        pannerRef.current.coneOuterGain = 0;
        pannerRef.current.setPosition(0, 0, -1); // Sound in front
        
        if (ctx.listener) {
            if (ctx.listener.forwardX) {
                ctx.listener.forwardX.value = 0;
                ctx.listener.forwardY.value = 0;
                ctx.listener.forwardZ.value = -1;
                ctx.listener.upX.value = 0;
                ctx.listener.upY.value = 1;
                ctx.listener.upZ.value = 0;
            } else {
                ctx.listener.setOrientation(0, 0, -1, 0, 1, 0);
            }
        }
      }

      setAudioEngineReady(true);
    } catch (e) {
      // console.error('Audio Engine Init Failed:', e);
      setAudioMode('standard');
      setAudioFormat('Standard Stereo');
      setAudioEngineReady(false);
    }
  }, [src, isEmbed, videoRef]);

  // Handle Audio Graph Connections
  useEffect(() => {
    if (isEmbed || !audioEngineReady || !sourceNodeRef.current || !audioCtxRef.current) return;

    const ctx = audioCtxRef.current;
    const source = sourceNodeRef.current;
    const gain = gainNodeRef.current!;
    const analyser = analyserNodeRef.current!;
    const compressor = compressorRef.current!;
    const panner = pannerRef.current!;

    // Disconnect everything to reset graph
    try {
        source.disconnect();
        gain.disconnect();
        analyser.disconnect();
        compressor.disconnect();
        panner.disconnect();
    } catch (e) { 
        // Ignore disconnect errors
    }

    // Base Chain: Source -> Gain
    source.connect(gain);

    // Routing Logic
    let lastNode: AudioNode = gain;

    // 1. Spatial Audio (Binaural Virtualization)
    if (audio?.spatialEnabled && audio.outputMode === 'binaural-virtualized') {
      gain.connect(panner);
      lastNode = panner;

      // Optional: Chain compressor after panner if Cinema Mode is also active
      if (audioMode === 'cinema') {
        panner.connect(compressor);
        lastNode = compressor;
      }
    }
    // 2. Cinema Mode (Compressor only)
    else if (audioMode === 'cinema') {
      gain.connect(compressor);
      lastNode = compressor;
    } 
    // 3. Standard / Passthrough (Direct)
    else {
      // gain is already lastNode
    }

    // Final Chain: LastNode -> Analyser -> Destination
    lastNode.connect(analyser);
    analyser.connect(ctx.destination);

  }, [audioMode, isEmbed, audio, audioEngineReady]);

  const resumeAudioContext = useCallback(async () => {
    if (audioCtxRef.current?.state === 'suspended') {
      try {
        await audioCtxRef.current.resume();
      } catch (e) {
        // console.error("Failed to resume audio context", e);
      }
    }
  }, []);

  const setVolume = useCallback((val: number) => {
    if (gainNodeRef.current) {
        // Use exponential ramp for natural volume change
        const now = audioCtxRef.current?.currentTime || 0;
        // Clamp value to avoid error with 0 in exponentialRampToValueAtTime
        const safeVal = Math.max(0.0001, val); 
        gainNodeRef.current.gain.cancelScheduledValues(now);
        gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, now);
        gainNodeRef.current.gain.exponentialRampToValueAtTime(safeVal, now + 0.1);
        
        // If 0, explicitly mute after ramp
        if (val === 0) {
            setTimeout(() => {
                if (gainNodeRef.current) gainNodeRef.current.gain.value = 0;
            }, 100);
        }
    }
  }, []);

  const detectAudioCapabilities = async () => {
    if (!videoRef.current) return;

    // --- Audio Detection ---
    let detectedFormat = 'Optimized Stereo';
    let recommendedMode: 'cinema' | 'standard' = 'cinema';

    // 1. Check video tracks (Electron/Chrome)
    const videoEl = videoRef.current as unknown as { audioTracks?: ExtendedAudioTrackList };
    const audioTracks = videoEl.audioTracks;

    if (audioTracks && audioTracks.length > 0) {
       const tracks: ExtendedAudioTrack[] = [];
       for (let i = 0; i < audioTracks.length; i++) {
         tracks.push(audioTracks[i]);
       }
       setAvailableTracks(tracks);

       const firstTrack = audioTracks[0];
       if (firstTrack?.label) {
         const label = firstTrack.label.toLowerCase();
         if (label.includes('atmos')) {
           detectedFormat = 'Dolby Atmos';
           recommendedMode = 'standard';
         } else if (label.includes('5.1') || label.includes('surround') || label.includes('ac3') || label.includes('dts')) {
           detectedFormat = 'Surround 5.1';
           recommendedMode = 'standard';
         }
       }
    }

    // 2. Check Media Capabilities (Spatial Audio Confirmation)
    if (navigator.mediaCapabilities) {
      try {
        const config: MediaDecodingConfiguration = {
          type: 'file',
          audio: {
            contentType: 'audio/mp4; codecs="mp4a.40.2"',
            spatialRendering: true
          }
        };
        const info = await navigator.mediaCapabilities.decodingInfo(config);
        if (info.supported && info.keySystemAccess === null) {
          // Device supports spatial rendering
        }
      } catch {
        // Ignore
      }
    }

    setAudioFormat(detectedFormat);
    if (recommendedMode === 'standard') {
      setAudioMode('standard');
    }
  };

  const switchAudioTrack = useCallback((trackToSelect: ExtendedAudioTrack) => {
    if (isEmbed) return;
    const videoEl = videoRef.current as unknown as { audioTracks?: ExtendedAudioTrackList };
    if (videoEl?.audioTracks) {
       for (let i = 0; i < videoEl.audioTracks.length; i++) {
         const track = videoEl.audioTracks[i];
         track.enabled = track === trackToSelect;
       }
       const newTracks: ExtendedAudioTrack[] = [];
       for (let i = 0; i < videoEl.audioTracks.length; i++) {
         newTracks.push(videoEl.audioTracks[i]);
       }
       setAvailableTracks(newTracks);
    }
  }, [isEmbed, videoRef]);

  return {
    audioMode,
    setAudioMode,
    audioFormat,
    resumeAudioContext,
    setVolume,
    availableTracks,
    detectAudioCapabilities,
    switchAudioTrack,
    analyserNode: analyserNodeRef.current
  };
}
