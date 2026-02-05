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
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const pannerRef = useRef<PannerNode | null>(null);

  // Initialize Audio Context (Cinema Audio)
  useEffect(() => {
    if (isEmbed || !videoRef.current || !src) return;
    
    try {
      if (audioCtxRef.current) return;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      const source = ctx.createMediaElementSource(videoRef.current);
      const compressor = ctx.createDynamicsCompressor();

      // Configure Compressor for "Cinema Audio"
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      source.connect(compressor);
      compressor.connect(ctx.destination);

      audioCtxRef.current = ctx;
      sourceNodeRef.current = source;
      compressorRef.current = compressor;

      setAudioEngineReady(true);
    } catch (e) {
      setAudioMode('standard');
      setAudioFormat('Standard Stereo');
      setAudioEngineReady(false);
    }
  }, [src, isEmbed, videoRef]);

  // Handle Audio Mode Switching
  useEffect(() => {
    if (isEmbed || !sourceNodeRef.current || !compressorRef.current || !audioCtxRef.current) return;

    // Disconnect all previous connections
    sourceNodeRef.current.disconnect();
    compressorRef.current.disconnect();
    if (pannerRef.current) pannerRef.current.disconnect();

    // 1. Spatial Audio (Binaural Virtualization)
    if (audio?.spatialEnabled && audio.outputMode === 'binaural-virtualized') {
      if (!pannerRef.current) {
         pannerRef.current = audioCtxRef.current.createPanner();
         pannerRef.current.panningModel = 'HRTF';
         pannerRef.current.distanceModel = 'inverse';
         pannerRef.current.refDistance = 1;
         pannerRef.current.maxDistance = 10000;
         pannerRef.current.rolloffFactor = 1;
         pannerRef.current.coneInnerAngle = 360;
         pannerRef.current.coneOuterAngle = 0;
         pannerRef.current.coneOuterGain = 0;
         
         // Position listener slightly offset
         if (audioCtxRef.current.listener) {
            audioCtxRef.current.listener.setPosition(0, 0, 0);
         }
         pannerRef.current.setPosition(0, 0, -1); // Sound in front
      }

      sourceNodeRef.current.connect(pannerRef.current);
      // Optional: Chain compressor after panner for volume consistency
      if (audioMode === 'cinema') {
        pannerRef.current.connect(compressorRef.current);
        compressorRef.current.connect(audioCtxRef.current.destination);
      } else {
        pannerRef.current.connect(audioCtxRef.current.destination);
      }
    }
    // 2. Cinema Mode (Compressor)
    else if (audioMode === 'cinema') {
      sourceNodeRef.current.connect(compressorRef.current);
      compressorRef.current.connect(audioCtxRef.current.destination);
    } 
    // 3. Standard / Passthrough
    else {
      sourceNodeRef.current.connect(audioCtxRef.current.destination);
    }
  }, [audioMode, isEmbed, audio]);

  const resumeAudioContext = () => {
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

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

    // 3. Channel Count Check
    if (audioCtxRef.current) {
      const dest = audioCtxRef.current.destination;
      if (dest.maxChannelCount >= 6 && detectedFormat === 'Optimized Stereo') {
         // Could upgrade detectedFormat if needed
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
    setAudioFormat,
    audioEngineReady,
    resumeAudioContext,
    availableTracks,
    detectAudioCapabilities,
    switchAudioTrack
  };
}
