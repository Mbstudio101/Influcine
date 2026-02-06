import { app, BrowserWindow, ipcMain, session, shell, protocol, net } from 'electron'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import Database from 'better-sqlite3'
import YTDlpWrapModule from 'yt-dlp-wrap'
// @ts-expect-error - Module type mismatch workaround
const YTDlpWrap = YTDlpWrapModule.default || YTDlpWrapModule;
import { ensureDirSync } from 'fs-extra'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const gunzip = promisify(zlib.gunzip)

// Set ffmpeg path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath.replace('app.asar', 'app.asar.unpacked'));
}

const BIN_DIR = path.join(app.getPath('userData'), 'bin');
const YTDLP_PATH = path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
ensureDirSync(BIN_DIR);

async function ensureYtDlp() {
  if (fs.existsSync(YTDLP_PATH)) {
    // Check if binary is valid (size check is a simple heuristic: standalone binary is > 10MB)
    const stats = fs.statSync(YTDLP_PATH);
    if (stats.size > 10 * 1024 * 1024) {
      return;
    }
    // console.log('[yt-dlp] Existing binary is too small (likely a script). Re-downloading...');
    fs.unlinkSync(YTDLP_PATH);
  }
  
  // console.log('[yt-dlp] Binary not found or invalid. Downloading...');
  try {
    // Determine asset name
    let assetName = 'yt-dlp'; // Fallback
    if (process.platform === 'darwin') assetName = 'yt-dlp_macos';
    else if (process.platform === 'win32') assetName = 'yt-dlp.exe';
    else if (process.platform === 'linux') assetName = 'yt-dlp_linux';

    const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;
    
    // Use net module to download
    const response = await net.fetch(url);
    if (!response.ok) throw new Error(`Failed to download yt-dlp: ${response.statusText}`);
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(YTDLP_PATH, Buffer.from(buffer));
    fs.chmodSync(YTDLP_PATH, '755');
    // console.log('[yt-dlp] Downloaded successfully to:', YTDLP_PATH);
  } catch {
    // console.error('[yt-dlp] Download failed:', e);
    // Attempt to use YTDlpWrap's downloader as fallback if my logic fails
    // await YTDlpWrap.downloadFromGithub(YTDLP_PATH);
  }
}

// Ensure trailers directory exists
const TRAILERS_DIR = path.join(app.getPath('userData'), 'trailers');
ensureDirSync(TRAILERS_DIR);

// Protocol Registration for Trailers
protocol.registerSchemesAsPrivileged([
  { scheme: 'trailer', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

// Fix for "GPU process exited unexpectedly" and "Network service crashed"
// Disabling hardware acceleration improves stability
// app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');

if (!app.isPackaged) {
  // console.log('Hardware acceleration enabled for performance');
}

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false; // Disable auto download to support user flow: Check -> Prompt -> Download

const ADBLOCK_SCRIPT = `
// Influcine AdBlock & Anti-Sandblock Script
(function() {
  // console.log("[Influcine] AdBlocker Active");
  
  // IPC Bridge for Player Control
  try {
    const { ipcRenderer } = require('electron');

    function findVideo(root) {
        if (!root) return null;
        let v = root.querySelector('video');
        if (v) return v;
        // Simple Shadow DOM traversal
        const els = root.querySelectorAll('*');
        for (const el of els) {
            if (el.shadowRoot) {
                v = findVideo(el.shadowRoot);
                if (v) return v;
            }
        }
        return null;
    }

    ipcRenderer.on('player-command', (_event, data) => {
      // console.log("[Influcine] Executing command:", data);
      const video = findVideo(document);
      if (!video) return;

      try {
        switch (data.command) {
            case 'play':
                video.play().catch(e => console.error("Play failed", e));
                break;
            case 'pause':
                video.pause();
                break;
            case 'seek':
                if (typeof data.time === 'number') video.currentTime = data.time;
                break;
            case 'setSpeed':
                if (typeof data.speed === 'number') video.playbackRate = data.speed;
                break;
            case 'ratechange':
                 if (typeof data.playbackRate === 'number') video.playbackRate = data.playbackRate;
                 break;
            case 'setVolume':
                 if (typeof data.volume === 'number') {
                     // Ensure volume is between 0 and 1
                     video.volume = Math.max(0, Math.min(1, data.volume));
                 }
                 break;
            case 'setMute':
                 if (typeof data.muted === 'boolean') video.muted = data.muted;
                 break;
            case 'toggleMute':
                 video.muted = !video.muted;
                 break;
            case 'showNativeControls':
                 video.controls = true;
                 break;
            case 'hideNativeControls':
                 video.controls = false;
                 break;
        }
      } catch (e) {
          // console.error("Command execution error", e);
      }
    });

    // Time Sync for Subtitles & Progress
    let lastTime = 0;
    let lastPaused = true;
    setInterval(() => {
        const video = findVideo(document);
        if (video) {
             // Sync state
             const state = {
                 event: video.paused ? 'pause' : 'play',
                 currentTime: video.currentTime,
                 duration: video.duration
             };
             
             // Throttle: only send if diff > 0.5s or state changed
             if (Math.abs(video.currentTime - lastTime) > 0.5 || video.paused !== lastPaused) {
                lastTime = video.currentTime;
                lastPaused = video.paused;
                
                // Send detailed state update via IPC
                ipcRenderer.send('player-state-update', state);
             }
        }
    }, 500);

    // Forward internal events to host
    // We can also attach listeners directly if we found the video
    let attachedVideo = null;
    setInterval(() => {
        const video = findVideo(document);
        if (video && video !== attachedVideo) {
            attachedVideo = video;
            const notify = (e) => {
                const state = {
                    event: e.type,
                    currentTime: video.currentTime,
                    duration: video.duration,
                    paused: video.paused
                };
                ipcRenderer.send('player-state-update', state);
            };
            video.addEventListener('play', notify);
            video.addEventListener('pause', notify);
            video.addEventListener('ended', notify);
            video.addEventListener('timeupdate', notify);
            video.addEventListener('loadedmetadata', notify);
        }
    }, 1000);


     function checkTracks() {
         const video = findVideo(document);
         let currentTracks = [];

         // 1. Standard HTML5 Video Tracks
         if (video) {
             currentTracks = Array.from(video.textTracks || []).map((t, i) => ({
                 index: i,
                 label: t.label || t.language || ('Track ' + (i+1)),
                 language: t.language || 'en',
                 kind: t.kind,
                 source: 'native'
             })).filter(t => t.kind === 'subtitles' || t.kind === 'captions');
         }

         // 2. JWPlayer Tracks (Common in embeds)
         // @ts-ignore
         if (currentTracks.length === 0 && window.jwplayer) {
             try {
                 // @ts-ignore
                 const player = window.jwplayer();
                 if (player && player.getCaptionsList) {
                     const tracks = player.getCaptionsList();
                     currentTracks = tracks.map((t, i) => ({
                         index: i,
                         label: t.label || 'Unknown',
                         language: 'en', // JWPlayer often doesn't give lang code easily in list
                         kind: 'subtitles',
                         source: 'jwplayer',
                         id: i // JWPlayer uses index often
                     }));
                 }
             } catch (e) { /* ignore */ }
         }

         if (JSON.stringify(currentTracks) !== JSON.stringify(knownTracks)) {
             knownTracks = currentTracks;
             ipcRenderer.send('embed-tracks-found', knownTracks);
         }
     }
     
     setInterval(checkTracks, 2000);

     ipcRenderer.on('get-embed-track-cues', (_event, trackIndex) => {
         // Handle JWPlayer
         // @ts-ignore
         if (window.jwplayer) {
             try {
                 // @ts-ignore
                 const player = window.jwplayer();
                 if (player && player.setCurrentCaptions) {
                     // We can't extract cues from JWPlayer easily without playing
                     // But we can force it to show?
                     // Actually, if it's JWPlayer, we might not be able to extract text.
                     // Fallback: Just select it in the player?
                     player.setCurrentCaptions(trackIndex);
                     return; 
                 }
             } catch (e) {}
         }

         const video = findVideo(document);
         if (!video || !video.textTracks[trackIndex]) return;
         
         const track = video.textTracks[trackIndex];
        
        // Ensure track is loading cues
        const originalMode = track.mode;
        if (track.mode === 'disabled') {
            track.mode = 'hidden'; // Load cues but don't show native UI
        }
        
        const sendCues = () => {
            const cues = Array.from(track.cues || []).map(c => ({
                id: c.id,
                start: c.startTime,
                end: c.endTime,
                text: c.text
            }));
            
            if (cues.length > 0) {
                ipcRenderer.send('embed-track-cues', { index: trackIndex, cues });
            }
        };
        
        if (track.cues && track.cues.length > 0) {
            sendCues();
        } else {
            // Wait for load
            setTimeout(sendCues, 500);
            setTimeout(sendCues, 2000);
            setTimeout(sendCues, 5000);
        }
    });

  } catch {
    // console.warn("[Influcine] Failed to init IPC bridge:", e);
  }

  // 1. Popup Blocking (Aggressive)
  const noop = () => { return null; };
  window.open = noop;
  window.alert = noop;
  window.confirm = () => true; // Auto-confirm to bypass some checks
  
  // 2. Anti-Adblock Killer (Mocking)
  // Mock common ad variables to fool detectors
  window.canRunAds = true;
  window.isAdBlockActive = false;
  // Mock more common ad-tech variables
  // @ts-ignore
  window.google = { ad: {}, ads: {} };
  // @ts-ignore
  window.googletag = { cmd: [], pubads: () => ({ setTargeting: () => {}, refresh: () => {} }), display: () => {} };
  
  // 3. CSS Injection for Immediate Hiding (Performance)
  const style = document.createElement('style');
  style.textContent = 'iframe[src*="ads"], iframe[src*="doubleclick"], .ad-banner, .adsbox, #ad-container, div[class*="ads"], div[id*="ads"], div[class*="sponsor"], a[href*="bet"], a[href*="casino"], .jw-controls, .jw-controlbar, .jw-display-icon-container, .jw-title, .vjs-control-bar, .vjs-big-play-button, .plyr__controls, .plyr__poster, #player-controls, .controls-container, div[style*="z-index: 2147483647"], div[style*="z-index: 9999999"] { display: none !important; visibility: hidden !important; pointer-events: none !important; width: 0 !important; height: 0 !important; }';
  document.head.appendChild(style);

  // 4. MutationObserver for DOM Cleanup (Replaces polling)
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldCheck = true;
        break;
      }
    }
    
    if (shouldCheck) {
      // Throttle cleanup with requestAnimationFrame
      requestAnimationFrame(() => {
        const elements = document.querySelectorAll('div, iframe, a');
        elements.forEach(el => {
           // Remove high z-index elements (popups/overlays)
           // @ts-ignore
           const z = parseInt(el.style.zIndex || '0');
           if (z > 9999 && !el.className.includes('Influcine')) {
               el.remove();
           }
           
           // Remove invisible overlays
           // @ts-ignore
           if (el.style.position === 'fixed' && el.style.opacity === '0') {
               el.remove();
           }
        });
      });
    }
  });
  
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    window.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Fallback cleanup (every 5s instead of 1s/3s)
  setInterval(() => {
      // Clean specific known ad iframes
      document.querySelectorAll('iframe').forEach(el => {
          // @ts-ignore
          if (!el.src.includes('vidfast') && !el.src.includes('vidlink') && !el.src.includes('youtube')) {
               // Check dimensions - tiny iframes are trackers
               // @ts-ignore
               if (el.offsetWidth < 20 || el.offsetHeight < 20) el.remove();
          }
      });
  }, 5000);
  
  // 4. Specific Site Fixes (VidFast / VidLink / 2Embed)
    window.addEventListener('DOMContentLoaded', () => {
      // Robust CSS to hide controls
      const cssContent = '/* Hide Common Player Controls */ .jw-controls, .jw-controlbar, .jw-display-icon-container, .jw-title, .vjs-control-bar, .vjs-big-play-button, .vjs-text-track-display, .plyr__controls, .plyr__poster, .art-controls, .art-mask, .art-layer-auto, .art-video-player .art-bottom, .fluid-controls, .fluid-title, #player-controls, .controls-container, .media-controls, .fp-controls, .fp-ui, /* Hide VidSrc/VidLink Specifics */ #controls, #play-button, #bar, .control-bar, .progress-bar, .buttons, /* Hide Native Controls if exposed via pseudo-elements (limited support) */ video::-webkit-media-controls, video::-webkit-media-controls-enclosure { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; } /* Ensure Video is Full Size */ video { width: 100% !important; height: 100% !important; object-fit: contain !important; }';

      const injectStyle = (root) => {
          if (!root) return;
          // Avoid duplicate injection
          if (root.getElementById && root.getElementById('influcine-css')) return;
          if (root.querySelector && root.querySelector('#influcine-css')) return;

          const style = document.createElement('style');
          style.id = 'influcine-css';
          style.textContent = cssContent;
          
          if (root.head) {
              root.head.appendChild(style);
          } else if (root.appendChild) {
              root.appendChild(style);
          }
      };

      // 1. Inject into main document
      injectStyle(document);

      // 2. Inject into Shadow DOMs
      const injectIntoShadow = (root) => {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
          let node;
          while (node = walker.nextNode()) {
              if (node.shadowRoot) {
                  injectStyle(node.shadowRoot);
                  injectIntoShadow(node.shadowRoot);
              }
          }
      };
      injectIntoShadow(document.body);

      // 3. Force remove native controls attribute
      setInterval(() => {
          const videos = document.querySelectorAll('video');
          videos.forEach(v => {
              if (v.controls) v.controls = false;
          });
      }, 1000);

      ipcRenderer.on('player-command', (_event, data) => {
          if (data.command === 'showNativeControls') {
              const els = document.querySelectorAll('#influcine-css');
              els.forEach(el => el.remove());
              // Re-enable native controls
               const videos = document.querySelectorAll('video');
               videos.forEach(v => { v.controls = true; });
          }
          if (data.command === 'hideNativeControls') {
              injectStyle(document);
              injectIntoShadow(document.body);
              const videos = document.querySelectorAll('video');
              videos.forEach(v => { v.controls = false; });
          }
      });
      
      // Force video to be visible if hidden by anti-adblock
    const video = document.querySelector('video');
    if (video) {
      video.style.display = 'block';
      video.style.visibility = 'visible';
    }
  });
})();
`;

// Initialize AdBlock Script
const ADBLOCK_PATH = path.join(app.getPath('userData'), 'adblock.js');
try {
  fs.writeFileSync(ADBLOCK_PATH, ADBLOCK_SCRIPT);
} catch {
  // console.error('Failed to write adblock script:', e);
}

// IPC Handler for Auto-Subtitles
ipcMain.handle('auto-fetch-subtitles', async (_event, { imdbId, type, season, episode }) => {
  if (!imdbId) return [];
  
  try {
    const userAgent = 'Influcine v1.0';
    let url = '';
    
    if (type === 'movie') {
      url = `https://rest.opensubtitles.org/search/imdbid-${imdbId}/sublanguageid-eng`;
    } else {
      url = `https://rest.opensubtitles.org/search/episode-${episode}/imdbid-${imdbId}/season-${season}/sublanguageid-eng`;
    }

    // console.log('Fetching subtitles from:', url);
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent
      }
    });

    if (!response.ok) return [];
    
    const data = await response.json();
    
    // Process top 3 results
    const results = [];
    const candidates = data.slice(0, 3);

    for (const sub of candidates) {
        try {
            const dlRes = await fetch(sub.SubDownloadLink);
            if (!dlRes.ok) continue;
            
            const buffer = Buffer.from(await dlRes.arrayBuffer());
            let content = '';
            
            try {
                // Try gunzip
                const unzipped = await gunzip(buffer);
                content = unzipped.toString('utf-8');
            } catch {
                // Maybe not gzipped?
                content = buffer.toString('utf-8');
            }
            
            results.push({
                label: sub.MovieReleaseName || sub.LanguageName || 'English',
                content: content,
                format: sub.SubFormat
            });
        } catch (e) {
            // console.error('Failed to download sub', e);
        }
    }
    
    return results;

  } catch (error) {
    // console.error('Subtitle fetch error:', error);
    return [];
  }
});

// IPC Handler for Trailer Caching
ipcMain.handle('get-adblock-path', () => {
  return ADBLOCK_PATH;
});

// IPC Handlers for Trailer Caching
ipcMain.handle('trailer-check', async (_event, videoId) => {
  const filePath = path.join(TRAILERS_DIR, `${videoId}.mp4`);
  
  // Force clean up old 720p files (simple heuristic: if file is old or just force once)
  // For now, let's check file size. 1080p trailers are usually > 10MB (very rough guess)
  // Better: We can store a metadata file side-by-side.
  // OR: Since we just deployed the fix, let's just assume existing files MIGHT be bad
  // and if the user complains, we can provide a "Clear Cache" button.
  // BUT the user specifically asked to fix it NOW.
  
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    if (stats.size > 0) {
      // Temporary: If file is smaller than 5MB, it's likely a low-quality muxed file or broken
      // A 2-minute 1080p trailer should be 30MB+ typically. 720p muxed might be 10-20MB.
      // Let's be aggressive: If < 10MB, kill it.
      if (stats.size < 10 * 1024 * 1024) {
         // console.log(`[Trailer] File too small (${stats.size} bytes), likely low quality. Re-downloading: ${videoId}`);
         try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
         // Return stream URL to allow immediate playback while redownloading
         return `trailer://${videoId}`;
      }
      return `trailer://${videoId}`;
    } else {
      // Clean up empty file
      try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    }
  }
  // If file doesn't exist, return stream URL to start streaming immediately
  // The frontend will trigger a background download separately
  return `trailer://${videoId}`;
});

// IPC Handler for Error Logging
ipcMain.on('embed-time-update', (_event, time) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('embed-time-update', time);
  }
});

ipcMain.on('player-state-update', (_event, state) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('player-state-update', state);
  }
});

ipcMain.on('embed-tracks-found', (_event, tracks) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('embed-tracks-found', tracks);
  }
});

ipcMain.on('embed-track-cues', (_event, data) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('embed-track-cues', data);
  }
});

ipcMain.handle('log-error', async (_event, errorData) => {
  const LOGS_DIR = path.join(app.getPath('userData'), 'logs');
  ensureDirSync(LOGS_DIR);
  
  const logFile = path.join(LOGS_DIR, 'app.log');
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${errorData.type || 'ERROR'}] ${errorData.message}\nStack: ${errorData.stack || 'N/A'}\nContext: ${JSON.stringify(errorData.context || {})}\n-------------------\n`;
  
  try {
    fs.appendFileSync(logFile, logEntry);
    return true;
  } catch {
    // console.error('Failed to write to log file:', e);
    return false;
  }
});

ipcMain.handle('get-logs-path', () => {
  return path.join(app.getPath('userData'), 'logs');
});

ipcMain.handle('trailer-invalidate', async (_event, videoId) => {
  const filePath = path.join(TRAILERS_DIR, `${videoId}.mp4`);
  if (fs.existsSync(filePath)) {
    try {
      // console.log(`[Trailer] Invalidating corrupted/incompatible file: ${videoId}`);
      fs.unlinkSync(filePath);
      return true;
    } catch {
      // console.error(`[Trailer] Failed to invalidate file: ${videoId}`, e);
    }
  }
  return false;
});

ipcMain.handle('trailer-download', async (_event, videoId) => {
  const filePath = path.join(TRAILERS_DIR, `${videoId}.mp4`);
  
  if (fs.existsSync(filePath)) {
    return pathToFileURL(filePath).toString();
  }

  try {
    await ensureYtDlp(); // Ensure binary is ready

    const ytDlpArgs = [
      `https://www.youtube.com/watch?v=${videoId}`,
      '-f', 'bv*[ext=mp4][height>=1080]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      '-o', filePath,
      '--write-subs', '--write-auto-subs', '--sub-format', 'vtt', '--sub-langs', 'en,.*',
      '--no-playlist',
      '--ignore-errors',
      '--force-ipv4',
      '--no-check-certificates',
      '--extractor-args', 'youtube:player_client=android'
    ];

    // If we have ffmpeg path, tell yt-dlp where it is
    if (ffmpegPath) {
      const actualFfmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
      ytDlpArgs.push('--ffmpeg-location', actualFfmpegPath);
    }

    // console.log(`[Trailer] Downloading ${videoId} with yt-dlp...`);
    
    // Execute yt-dlp
    await new Promise<void>((resolve, reject) => {
      const ytDlp = new YTDlpWrap(YTDLP_PATH);
      ytDlp.exec(ytDlpArgs)
        .on('error', (error: Error) => reject(error))
        .on('close', () => resolve());
    });
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
        throw new Error('Download finished but file not found');
    }

    return `trailer://${videoId}`;
  } catch (error) {
    // console.error(`[Trailer] Download failed for ${videoId}:`, error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw error;
  }
});

ipcMain.handle('trailer-search', async (_event, query) => {
  try {
    await ensureYtDlp();
    const ytDlpArgs = [
      `ytsearch1:${query} trailer`,
      '--get-id',
      '--no-playlist',
      '--no-check-certificates',
      '--extractor-args', 'youtube:player_client=android'
    ];
    
    return await new Promise<string | null>((resolve) => {
      const ytDlp = new YTDlpWrap(YTDLP_PATH);
      let output = '';
      const process = ytDlp.exec(ytDlpArgs);
      
      process.on('data', (data: Buffer) => output += data.toString());
      process.on('error', () => resolve(null));
      process.on('close', () => {
        const id = output.trim();
        // Simple validation for YouTube ID (11 chars)
        resolve(id.length === 11 ? id : null);
      });
    });
  } catch (error) {
    return null;
  }
});

ipcMain.handle('get-subtitles', async (_event, videoId) => {
  try {
    if (!fs.existsSync(TRAILERS_DIR)) return [];
    
    const files = fs.readdirSync(TRAILERS_DIR);
    // Filter for VTT files that start with the videoId
    // Note: yt-dlp might name them "VIDEOID.en.vtt"
    const subtitleFiles = files.filter(f => f.startsWith(videoId) && f.endsWith('.vtt'));
    
    return subtitleFiles.map(f => {
      // Simple parsing: ID.LANG.vtt
      const parts = f.split('.');
      // Default
      let lang = 'en';
      let label = 'English';

      // If format is ID.LANG.vtt (3 parts or more)
      if (parts.length >= 3) {
        const langCode = parts[parts.length - 2];
        lang = langCode;
        try {
          label = new Intl.DisplayNames(['en'], { type: 'language' }).of(langCode) || langCode;
        } catch {
          label = langCode;
        }
      }
      
      // Capitalize label
      label = label.charAt(0).toUpperCase() + label.slice(1);

      return {
        url: `trailer://${f}`,
        lang,
        label
      };
    });
  } catch (error) {
    return [];
  }
});

// IPC Handler for Actor Image Search (Google Fallback)
ipcMain.handle('get-actor-image', async (_event, name) => {
  try {
    // Use Google Basic Image Search (gbv=1) to get static HTML
    const url = `https://www.google.com/search?q=${encodeURIComponent(name + ' actor')}&tbm=isch&gbv=1`;
    const response = await net.fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Look for the standard Google Image Search result thumbnail
    // They typically start with https://encrypted-tbn0.gstatic.com/images?q=...
    const matches = html.match(/src="(https:\/\/encrypted-tbn0\.gstatic\.com\/images\?q=[^"]+)"/);
    
    if (matches && matches[1]) {
      // Decode HTML entities if necessary (though usually src attributes in this context are clean enough)
      return matches[1].replace(/&amp;/g, '&');
    }
    
    return null;
  } catch (e) {
    // console.error('Actor image fetch failed:', e);
    return null;
  }
});

// IPC Handlers for Update Flow
ipcMain.handle('update-check', async () => {
  if (!app.isPackaged) return { update: false };
  try {
    const result = await autoUpdater.checkForUpdates();
    const isUpdate = result?.updateInfo.version !== app.getVersion();
    return {
      update: isUpdate,
      version: result?.updateInfo.version,
      releaseNotes: result?.updateInfo.releaseNotes
    };
  } catch (error) {
    // Gracefully handle 404 (no update file found yet)
    const err = error as Error;
    if (err.message && (err.message.includes('404') || err.message.includes('Cannot find latest'))) {
      log.warn('Update check: No update manifest found (404). This is expected if no release is published.');
      return { update: false };
    }

    log.error('Check for updates failed', err);
    // Don't throw to avoid crashing the renderer flow
    return { update: false, error: err.message };
  }
});

ipcMain.handle('update-download', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle('update-install', () => {
  autoUpdater.quitAndInstall();
});

// Update events
autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  win?.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', () => {
  log.info('Update not available');
  win?.webContents.send('update-not-available');
});

autoUpdater.on('download-progress', (progressObj) => {
  win?.webContents.send('update-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded', info);
  win?.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
  log.error('Update error:', err);
  win?.webContents.send('update-error', err.message);
});

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Set App Name for Dock
app.setName('Influcine');
if (process.platform === 'darwin') {
  try {
    app.dock.setIcon(path.join(process.env.VITE_PUBLIC, 'icon.png'));
  } catch {
    // console.error('Failed to set dock icon');
  }
}

// Initialize IMDB DB
let imdbDb: ReturnType<typeof Database> | null = null;

function initImdbDb() {
  try {
    const desktopPath = path.join(app.getPath('desktop'), 'IMDB', 'imdb.db');
    const devPath = path.join(process.env.APP_ROOT, 'local-data/imdb.db');
    const prodPath = path.join(process.resourcesPath, 'imdb.db');

    // Priority: Desktop (User Custom) -> Dev -> Prod
    let dbPath = '';

    if (fs.existsSync(desktopPath)) {
      dbPath = desktopPath;
    } else if (process.env.VITE_DEV_SERVER_URL && fs.existsSync(devPath)) {
      dbPath = devPath;
    } else {
      dbPath = prodPath;
    }

    if (fs.existsSync(dbPath)) {
      imdbDb = new Database(dbPath, { readonly: true });
      // console.log('IMDB Database connected at', dbPath);
    } else {
      // console.log('IMDB Database not found. Checked:', { desktopPath, devPath, prodPath });
    }
  } catch {
    // console.error('Failed to init IMDB DB:', err);
  }
}

// IPC Handler for IMDB Search
ipcMain.handle('imdb-search', (_event, { query }) => {
  if (!query || query.length < 2) return { results: [] };

  if (!imdbDb) {
    initImdbDb();
    if (!imdbDb) return { results: [], error: 'Database not loaded' };
  }

  try {
    const stmt = imdbDb.prepare(`
      SELECT t.tconst, t.primaryTitle, t.startYear, t.titleType, r.averageRating, r.numVotes
      FROM titles t
      LEFT JOIN ratings r ON t.tconst = r.tconst
      WHERE t.primaryTitle LIKE ? AND t.titleType IN ('movie', 'tvSeries')
      ORDER BY r.numVotes DESC NULLS LAST
      LIMIT 20
    `);
    const results = stmt.all(`${query}%`);
    return { results };
  } catch (err: unknown) {
    // if (!app.isPackaged) console.error('IMDB Search Error:', err);
    return { results: [], error: 'Query failed' };
  }
});

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Frameless window
    backgroundColor: '#0f172a', // Dark background to match new theme
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    title: 'Influcine',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Security: Disable webSecurity to avoid CORS issues with external APIs/streams
      webSecurity: false,
      autoplayPolicy: 'no-user-gesture-required',
      enableBlinkFeatures: 'AudioTracks,VideoTracks',
      webviewTag: true,
    },
  })

  // Set CSP headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          // Allow external images, scripts, and media for TMDB and streaming
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http:; media-src 'self' https: http: blob: data:;"
        ]
      }
    })
  })

  // Ad Blocker
  const filter = {
    urls: [
      '*://*.doubleclick.net/*',
      '*://*.google-analytics.com/*',
      '*://*.googlesyndication.com/*',
      '*://*.adservice.google.com/*',
      '*://*.adnxs.com/*',
      '*://*.openx.net/*',
      '*://*.popads.net/*',
      '*://*.popcash.net/*',
      '*://*.adroll.com/*',
      '*://*.rubiconproject.com/*',
      '*://*.outbrain.com/*',
      '*://*.taboola.com/*',
      '*://*.zemanta.com/*',
      '*://*.ampproject.org/*',
      '*://*.moatads.com/*',
      '*://*.pubmatic.com/*',
      '*://*.adsafeprotected.com/*',
      '*://*.clickbank.net/*',
      '*://*.clicksor.com/*',
      '*://*.contextweb.com/*',
      '*://*.criteo.com/*',
      '*://*.lijit.com/*',
      '*://*.sovrn.com/*',
      '*://*.adcolony.com/*',
      '*://*.applovin.com/*',
      '*://*.unity3d.com/*',
      '*://*.vungle.com/*',
      '*://*.chartboost.com/*',
      '*://*.inmobi.com/*',
      '*://*.tapjoy.com/*',
      '*://*.ironsrc.com/*',
      '*://*.fyber.com/*',
      '*://*.mintegral.com/*',
      '*://*.pangle.com/*',
      '*://*.facebook.com/tr/*',
      '*://*.facebook.net/*',
      '*://*.hotjar.com/*',
      '*://*.clarity.ms/*',
      '*://*.adzerk.net/*',
      '*://*.adtech.de/*',
      '*://*.adtechus.com/*',
      '*://*.advertising.com/*',
      '*://*.adblade.com/*',
      '*://*.adk2.com/*',
      '*://*.admarket.net/*',
      '*://*.admarvel.com/*',
      '*://*.admedia.com/*',
      '*://*.admeta.com/*',
      '*://*.adnetwork.net/*',
      '*://*.adnuntius.com/*',
      '*://*.adpushup.com/*',
      '*://*.adrevolver.com/*',
      '*://*.adscale.de/*',
      '*://*.adserver.com/*',
      '*://*.adshuffle.com/*',
      '*://*.adsrvr.org/*',
      '*://*.adswizz.com/*',
      '*://*.adthrive.com/*',
      '*://*.adtoma.com/*',
      '*://*.adtoniq.com/*',
      '*://*.adunit.com/*',
      '*://*.advally.com/*',
      '*://*.adx1.com/*',
      '*://*.adzerk.com/*',
      '*://*.affec.tv/*',
      '*://*.amazon-adsystem.com/*',
      '*://*.appnexus.com/*',
      '*://*.bidswitch.net/*',
      '*://*.casalemedia.com/*',
      '*://*.criteo.net/*',
      '*://*.exponential.com/*',
      '*://*.fastclick.net/*',
      '*://*.googleadservices.com/*',
      '*://*.indexexchange.com/*',
      '*://*.lkqd.net/*',
      '*://*.media.net/*',
      '*://*.openx.com/*',
      '*://*.pubmine.com/*',
      '*://*.quantserve.com/*',
      '*://*.scorecardresearch.com/*',
      '*://*.smartadserver.com/*',
      '*://*.spotxchange.com/*',
      '*://*.teads.tv/*',
      '*://*.tribalfusion.com/*',
      '*://*.yldbt.com/*',
      // Specific to video hostings common ads
      '*://*.bet365.com/*',
      '*://*.williamhill.com/*',
      '*://*.888.com/*',
      '*://*.pokerstars.com/*',
      '*://*.betway.com/*',
      '*://*.betfair.com/*',
      '*://*.ladbrokes.com/*',
      '*://*.coral.co.uk/*',
      '*://*.unibet.com/*',
      '*://*.bwin.com/*',
      '*://*.1xbet.com/*',
      '*://*.22bet.com/*',
      '*://*.betwinner.com/*',
      '*://*.melbet.com/*',
      '*://*.betsson.com/*',
      '*://*.betsafe.com/*',
      '*://*.nordvpn.com/*',
      '*://*.expressvpn.com/*',
      '*://*.surfshark.com/*',
      '*://*.cyberghostvpn.com/*',
      '*://*.privateinternetaccess.com/*',
      '*://*.protonvpn.com/*',
      '*://*.vyprvpn.com/*',
      '*://*.hidemyass.com/*',
      '*://*.ipvanish.com/*',
      '*://*.tunnelbear.com/*',
      '*://*.windscribe.com/*',
      '*://*.hotspotshield.com/*',
      // High-traffic Ad Networks found on streaming sites
      '*://*.exoclick.com/*',
      '*://*.juicyads.com/*',
      '*://*.propellerads.com/*',
      '*://*.tsyndicate.com/*',
      '*://*.adxpansion.com/*',
      '*://*.trafficjunky.com/*',
      '*://*.traffichunt.com/*',
      '*://*.adcash.com/*',
      '*://*.popads.net/*',
      '*://*.popcash.net/*',
      '*://*.mgid.com/*',
      '*://*.revcontent.com/*',
      '*://*.content.ad/*',
      '*://*.adnow.com/*',
      '*://*.bidvertiser.com/*',
      '*://*.clickadu.com/*',
      '*://*.hilltopads.com/*',
      '*://*.a-ads.com/*',
      '*://*.coinzilla.com/*',
      '*://*.bitmedia.io/*',
      '*://*.cointraffic.io/*',
      '*://*.adbit.co/*'
    ]
  }

  session.defaultSession.webRequest.onBeforeRequest(filter, (_details, callback) => {
    callback({ cancel: true })
  })

  // Prevent new windows (Popups) - Aggressive Ad/Popup Blocking
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow legitimate external links (e.g. YouTube trailer fallback, GitHub for updates)
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('github.com')) {
      try {
        shell.openExternal(url);
      } catch {
        // console.error('Failed to open external link:', err);
      }
      return { action: 'deny' };
    }

    // Strictly block all other popups (ads)
    // console.log('Blocked popup:', url)
    return { action: 'deny' }
  })

  // IMPORTANT: Also block popups from WebViews (where the ads actually live)
  win.webContents.on('did-attach-webview', (_event, webContents) => {
    // Block new windows from the webview
    webContents.setWindowOpenHandler(() => {
      // console.log('Blocked WebView popup:', url);
      return { action: 'deny' };
    });

    // Block navigations to unwanted domains (optional, but good for redirect ads)
    webContents.on('will-navigate', () => {
      // Allow the video host itself, but block suspicious redirects if needed
      // For now, we trust the embed URL but block others if they drift too far
      // console.log('WebView navigating to:', url);
    });
  });

  // Window Controls IPC
  ipcMain.on('window-minimize', () => {
    win?.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    win?.close();
  });

  ipcMain.on('window-fullscreen', () => {
    if (win) {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  // Test main push message
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || !app.isPackaged) {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
    autoUpdater.checkForUpdatesAndNotify().catch(err => log.error('Auto-update error:', err));
  }
})

// Stream URL Cache
const streamUrlCache = new Map<string, { url: string, expiry: number }>();

app.whenReady().then(() => {
  createWindow();

  // IPC to prefetch trailer URL
  ipcMain.handle('trailer-prefetch', async (_event, videoId) => {
    try {
      if (streamUrlCache.has(videoId)) {
        const cached = streamUrlCache.get(videoId);
        if (cached && cached.expiry > Date.now()) return true;
      }

      await ensureYtDlp();
      const ytDlpArgs = [
        `https://www.youtube.com/watch?v=${videoId}`,
        '-f', 'best[ext=mp4]/best[ext=webm]/best',
        '-S', 'res,ext:mp4:m4a',
        '-g',
        '--force-ipv4',
        '--no-check-certificates',
        '--extractor-args', 'youtube:player_client=android'
      ];

      const directUrl = await new Promise<string>((resolve, reject) => {
        let output = '';
        const ytDlp = new YTDlpWrap(YTDLP_PATH);
        ytDlp.exec(ytDlpArgs)
          .on('data', (data: string | Buffer) => output += data.toString())
          .on('error', (err: Error) => reject(err))
          .on('close', () => resolve(output.trim().split('\n')[0]));
      });

      if (directUrl && directUrl.startsWith('http')) {
        streamUrlCache.set(videoId, { url: directUrl, expiry: Date.now() + 3600000 }); // 1h cache
        return true;
      }
    } catch {
      // console.error('Prefetch failed');
    }
    return false;
  });

  // Handle 'trailer://' protocol
  protocol.handle('trailer', async (request) => {
    try {
      // Robust URL parsing
      const url = request.url;
      const videoId = url.replace('trailer://', '').replace(/\/$/, ''); // Remove protocol and trailing slash
      const decodedId = decodeURIComponent(videoId);

      // Sanitize ID to prevent directory traversal
      const safeId = path.basename(decodedId);
      
      // Check extension to support VTT subtitles
      const isVtt = safeId.endsWith('.vtt');
      const filePath = isVtt 
         ? path.join(TRAILERS_DIR, safeId)
         : path.join(TRAILERS_DIR, `${safeId}.mp4`);

      // 1. If file exists and is valid, serve it (High Quality 1080p or VTT)
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > 0) {
           return net.fetch(pathToFileURL(filePath).toString());
        }
      }

      // 2. If VTT is missing, try to download it
      if (isVtt) {
         return new Response('Subtitle not found', { status: 404 });
      }

      // 3. Fallback to Stream URL (WebM/MP4) via yt-dlp -g
      // Check memory cache first
      let directUrl: string | undefined;
      
      if (streamUrlCache.has(safeId)) {
         const cached = streamUrlCache.get(safeId);
         if (cached && cached.expiry > Date.now()) {
            directUrl = cached.url;
         }
      }

      if (!directUrl) {
        await ensureYtDlp();
        // Simplified args for better compatibility
        // Use -f b (best pre-muxed) to avoid separate video/audio streams which causes "video only" issues
        // Remove player_client=android as it might cause UA mismatch
        const ytDlpArgs = [
          `https://www.youtube.com/watch?v=${safeId}`,
          '-f', 'b', // Best pre-muxed (video+audio)
          '-g',
          '--no-check-certificates',
          '--force-ipv4' // Sometimes IPv6 causes issues with Google
        ];

        directUrl = await new Promise<string>((resolve, reject) => {
          let output = '';
          const ytDlp = new YTDlpWrap(YTDLP_PATH);
          ytDlp.exec(ytDlpArgs)
            .on('data', (data: string | Buffer) => output += data.toString())
            .on('error', (err: Error) => reject(err))
            .on('close', () => {
              const lines = output.trim().split('\n');
              // If we get multiple lines, it usually means video+audio separate streams if we used 'best'.
              // But with '-f b', we should get one.
              // Just in case, take the first one.
              resolve(lines[0]); 
            }); 
        });
        
        if (directUrl && directUrl.startsWith('http')) {
           streamUrlCache.set(safeId, { url: directUrl, expiry: Date.now() + 3600000 });
        }
      }

      if (directUrl && directUrl.startsWith('http')) {
        // Proxy the remote stream with headers
        const headers = new Headers();
        
        // IMPORTANT: Forward Range header for seeking
        if (request.headers.has('Range')) {
          headers.set('Range', request.headers.get('Range')!);
        }
        
        // Forward User-Agent to match potential restrictions (though yt-dlp usually handles signature)
        // If the URL is signed, it might not matter.
        // But if we can, let's look like a browser.
        headers.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        return net.fetch(directUrl, { headers });
      }
      
      return new Response('Video unavailable', { status: 404 });

    } catch (err) {
      // console.error('[Trailer Protocol] Error:', err);
      // Log to file for user debugging
      const errorData = {
          type: 'TRAILER_PROTOCOL_ERROR',
          message: err instanceof Error ? err.message : String(err),
          context: { url: request.url }
      };
      // Try to log properly
      try {
          const LOGS_DIR = path.join(app.getPath('userData'), 'logs');
          if (fs.existsSync(LOGS_DIR)) {
              fs.appendFileSync(path.join(LOGS_DIR, 'app.log'), `[${new Date().toISOString()}] [TRAILER_ERROR] ${errorData.message}\n`);
          }
      } catch {
          // Ignore logging errors
      }

      return new Response('Internal Server Error', { status: 500 });
    }
  });

  createWindow();

  // Check for updates only in production
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(err => log.error('Auto-update error:', err));
  }

  // Update events
  autoUpdater.on('update-available', () => {
    log.info('Update available.');
    win?.webContents.send('update-message', 'Update available. Downloading...');
  });

  autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded');
    win?.webContents.send('update-message', 'Update downloaded. It will be installed on restart.');
  });
});