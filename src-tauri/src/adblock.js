// Influcine AdBlock & Anti-Sandblock Script (Tauri version)
// Injected into embed webviews to block ads and control video playback.
(function() {
  // 1. Popup Blocking
  const noop = () => null;
  window.open = noop;
  window.alert = noop;
  window.confirm = () => true;

  // 2. Anti-Adblock Mocking
  window.canRunAds = true;
  window.isAdBlockActive = false;
  window.google = { ad: {}, ads: {} };
  window.googletag = {
    cmd: [],
    pubads: () => ({ setTargeting: () => {}, refresh: () => {} }),
    display: () => {}
  };

  // 3. CSS to hide player controls (Influcine provides its own)
  const cssContent = '/* Hide Common Player Controls */ .jw-controls, .jw-controlbar, .jw-display-icon-container, .jw-title, .vjs-control-bar, .vjs-big-play-button, .vjs-text-track-display, .plyr__controls, .plyr__poster, .art-controls, .art-mask, .art-layer-auto, .art-video-player .art-bottom, .fluid-controls, .fluid-title, #player-controls, .controls-container, .media-controls, .fp-controls, .fp-ui, #controls, #play-button, #bar, .control-bar, .progress-bar, .buttons, video::-webkit-media-controls, video::-webkit-media-controls-enclosure { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; width: 0 !important; height: 0 !important; } video { width: 100% !important; height: 100% !important; object-fit: contain !important; }';

  let isNativeMode = false;

  const injectStyle = (root) => {
    if (!root) return;
    if (root.querySelector && root.querySelector('#influcine-css')) return;
    const style = document.createElement('style');
    style.id = 'influcine-css';
    style.textContent = cssContent;
    if (root.head) root.head.appendChild(style);
    else if (root.appendChild) root.appendChild(style);
  };

  const removeStyle = () => {
    document.querySelectorAll('#influcine-css').forEach(el => el.remove());
  };

  // 4. DOM Cleanup Observer
  const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) { shouldCheck = true; break; }
    }
    if (shouldCheck) {
      requestAnimationFrame(() => {
        document.querySelectorAll('div, iframe, a').forEach(el => {
          const z = parseInt(el.style.zIndex || '0');
          if (z > 9999 && !el.className.includes('Influcine')) el.remove();
          if (el.style.position === 'fixed' && el.style.opacity === '0') el.remove();
        });
        if (isNativeMode) {
          document.querySelectorAll('video').forEach(v => { v.controls = true; });
        } else {
          injectStyle(document);
        }
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

  // 5. Periodic cleanup
  setInterval(() => {
    document.querySelectorAll('iframe').forEach(el => {
      if (!el.src.includes('vidfast') && !el.src.includes('vidlink') && !el.src.includes('youtube')) {
        if (el.offsetWidth < 20 || el.offsetHeight < 20) el.remove();
      }
    });
    if (isNativeMode) {
      document.querySelectorAll('video').forEach(v => { if (!v.controls) v.controls = true; });
    } else {
      document.querySelectorAll('video').forEach(v => { if (v.controls) v.controls = false; });
    }
  }, 1000);

  // 6. Tauri event bridge for player commands
  if (window.__TAURI__) {
    const { event } = window.__TAURI__;

    function findVideo(root) {
      if (!root) return null;
      if (root.querySelector) {
        const v = root.querySelector('video');
        if (v) return v;
      }
      return null;
    }

    function findAllVideos(root, out = []) {
      if (!root) return out;
      try {
        if (root.querySelectorAll) {
          root.querySelectorAll('video').forEach(v => out.push(v));
        }
      } catch (e) {}
      return out;
    }

    function notify() {
      const video = findVideo(document);
      if (video && event) {
        event.emit('player-state-update', {
          time: video.currentTime,
          duration: video.duration,
          paused: video.paused,
          volume: video.volume,
          muted: video.muted
        });
      }
    }

    const boundVideos = new WeakSet();
    function bindVideoEvents() {
      findAllVideos(document).forEach(video => {
        if (boundVideos.has(video)) return;
        boundVideos.add(video);
        video.addEventListener('play', notify);
        video.addEventListener('pause', notify);
        video.addEventListener('ended', notify);
        video.addEventListener('timeupdate', notify);
        video.addEventListener('loadedmetadata', notify);
      });
    }
    setInterval(bindVideoEvents, 1000);

    if (event && event.listen) {
      event.listen('player-command', (e) => {
        const data = e.payload;
        const video = findVideo(document);
        const videos = findAllVideos(document);

        if (data.command === 'showNativeControls') {
          isNativeMode = true;
          removeStyle();
          videos.forEach(v => { v.controls = true; });
        }
        if (data.command === 'hideNativeControls') {
          isNativeMode = false;
          injectStyle(document);
          videos.forEach(v => { v.controls = false; });
        }
        if (data.command === 'play') {
          videos.forEach(v => { try { v.play(); } catch(e) {} });
        }
        if (data.command === 'pause') {
          videos.forEach(v => { try { v.pause(); } catch(e) {} });
        }
        if (data.command === 'setVolume') {
          const vol = Math.max(0, Math.min(1, Number(data.volume ?? 1)));
          videos.forEach(v => { v.volume = vol; });
        }
        if (data.command === 'setMute') {
          videos.forEach(v => { v.muted = data.muted; });
        }
        if (data.command === 'seek' && video) {
          video.currentTime = data.time;
        }
        if ((data.command === 'setSpeed' || data.command === 'ratechange') && video) {
          const speed = Number(data.speed ?? data.playbackRate ?? 1);
          if (Number.isFinite(speed) && speed > 0) video.playbackRate = speed;
        }
      });
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (!isNativeMode) {
      injectStyle(document);
    }
    const video = document.querySelector('video');
    if (video) {
      video.style.display = 'block';
      video.style.visibility = 'visible';
    }
  });
})();
