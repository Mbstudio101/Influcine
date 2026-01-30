import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import Database from 'better-sqlite3'

// Suppress security warnings in development
if (process.env.VITE_DEV_SERVER_URL) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

// Fix for "GPU process exited unexpectedly" and "Network service crashed" during HMR
// Disabling hardware acceleration improves stability during development at the cost of performance
if (!app.isPackaged) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('no-sandbox');
  // console.log('Hardware acceleration and sandbox disabled for development stability');
}

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false; // Disable auto download to support user flow: Check -> Prompt -> Download

// IPC Handlers for Update Flow
ipcMain.handle('update-check', async () => {
  if (!app.isPackaged) return { update: false };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { 
      update: !!(result && result.downloadPromise === undefined), // true if update available
      version: result?.updateInfo.version,
      releaseNotes: result?.updateInfo.releaseNotes
    };
  } catch (error) {
    log.error('Check for updates failed', error);
    throw error;
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
if (process.platform === 'darwin') {
  app.dock.setIcon(path.join(process.env.VITE_PUBLIC, 'icon.png'));
}
app.setName('Influcine');

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
      console.log('IMDB Database connected at', dbPath);
    } else {
       console.log('IMDB Database not found. Checked:', { desktopPath, devPath, prodPath });
    }
  } catch (err) {
    console.error('Failed to init IMDB DB:', err);
  }
}

// IPC Handler for IMDB Search
ipcMain.handle('imdb-search', (_event, { query }) => {
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
    const results = stmt.all(`%${query}%`);
    return { results };
  } catch (err: unknown) {
    if (!app.isPackaged) console.error('IMDB Search Error:', err);
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
    ]
  }

  session.defaultSession.webRequest.onBeforeRequest(filter, (_details, callback) => {
    callback({ cancel: true })
  })

  // Prevent new windows (Popups) - Aggressive Ad/Popup Blocking
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Allow legitimate external links (e.g. YouTube trailer fallback)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    // Strictly block all other popups (ads)
    console.log('Blocked popup:', url)
    return { action: 'deny' }
  })

  // Window controls
  ipcMain.on('window-minimize', () => win?.minimize())
  ipcMain.on('window-maximize', () => {
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.on('window-close', () => win?.close())

  // Test active push message to Renderer-process.
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
  if (process.platform !== 'darwin') {
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

app.whenReady().then(() => {
  initImdbDb();
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
