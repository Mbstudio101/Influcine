# Spatial Audio with Dolby Atmos Integration Plan

## Executive Summary
This document outlines the technical strategy for integrating Spatial Audio with Dolby Atmos support into the Influcine media player. The goal is to provide an immersive 3D audio experience for supported content, leveraging the Electron runtime and modern web audio capabilities.

## 1. Technical Architecture

### A. Audio Pipeline Overview
**Current State:**
- Stereo (2.0) output via standard HTML5 Audio/Video elements.
- Basic gain node for volume control.

**Target State:**
- **Passthrough Mode**: Bitstream passthrough of Dolby Digital Plus (E-AC-3) with Atmos metadata to the OS audio mixer (HDMI/Optical/Internal).
- **Virtualization Mode**: Binaural rendering for headphones using HRTF (Head-Related Transfer Functions) if hardware passthrough is unavailable.

### B. Core Technologies
1.  **Electron Native Audio Handling**:
    - We cannot rely solely on the browser's `AudioContext` for Atmos bitstreaming.
    - **Action**: Implement an Electron main-process handler to interface with the OS audio subsystem (CoreAudio on macOS, WASAPI on Windows) to flag the stream as "Spatial" or "Dolby Atmos".
    
2.  **Codecs**:
    - **E-AC-3 (Dolby Digital Plus)**: The standard container for streaming Atmos.
    - **AC-4**: Next-gen codec (future proofing).
    - **Action**: Ensure `ffmpeg` or the playback engine (e.g., custom MPV build or platform player) supports E-AC-3 decoding or passthrough.

3.  **Web Audio API (Spatialization)**:
    - For non-Atmos content or headphone virtualization, use the `PannerNode` with `HRTF` panning model.
    - **Action**: Upgrade `InflucinePlayer.tsx` to utilize a customized `AudioContext` graph.

## 2. Implementation Phases

### Phase 1: Content Identification & UI (Completed/In-Progress)
- **Metadata Parsing**: Detect `channels` and `codec` from media files.
- **UI Indicators**: Display "Dolby Atmos" or "Spatial Audio" badges (Implemented in `MediaCard`).
- **User Preference**: Add toggle in Settings > Audio for "Spatial Audio Enabled".

### Phase 2: Audio Engine Upgrade (High Priority)
- **Task**: Integrate a spatial audio processor.
- **Library**: Consider `resonance-audio` (Google) or `mach1-spatial-system` for web-based rendering if raw Atmos bitstreaming isn't feasible directly via HTML5.
- **Passthrough**: For true Atmos, the app must output the raw bitstream.
    - *Challenge*: HTML Video elements decode internally.
    - *Solution*: Use a native node module (e.g., `audify` or custom Rust/C++ binding) to pipe audio data directly to the hardware device if the user selects "Bitstream Passthrough".

### Phase 3: Head Tracking (Optional/Advanced)
- For users with supported headphones (AirPods Pro, Galaxy Buds), listen to device motion events to adjust the soundstage relative to head position.

## 3. UI/UX Enhancements

### Audio Settings Panel
Add a new section in the player settings:
```typescript
interface AudioSettings {
  spatialEnabled: boolean;
  outputMode: 'stereo' | 'surround-5.1' | 'atmos-passthrough' | 'binaural-virtualized';
  dynamicHeadTracking: boolean; // Future
}
```

### Visualizer
- Implement a 3D audio visualizer showing sound sources in 3D space (using Three.js or Canvas) to demonstrate the spatial effect visually.

## 4. Testing Strategy
- **Hardware**: Test on MacBook Pro (built-in speakers support Atmos), Windows PC with Dolby Access, and Headphones.
- **Content**: Use "Dolby Atmos Leaf" and "Universe" demo files (MP4/MKV with E-AC-3 JOC).

## 5. Risks & Mitigation
- **Browser Support**: Chromium's support for AC-3/E-AC-3 is proprietary and may vary by OS licensing.
    - *Mitigation*: Fallback to software decoding to 5.1 PCM and use a spatializer node for headphones.
- **Performance**: HRTF convolution is CPU intensive.
    - *Mitigation*: Use WebAssembly (Wasm) for the audio processing graph.

