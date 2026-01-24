import { app, BrowserWindow, ipcMain, session } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

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
      webSecurity: false, // Allow cross-origin for iframes if needed
      autoplayPolicy: 'no-user-gesture-required',
    },
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
    ]
  }

  session.defaultSession.webRequest.onBeforeRequest(filter, (_details, callback) => {
    callback({ cancel: true })
  })

  // Prevent new windows (Popups) - Aggressive Ad/Popup Blocking
  win.webContents.setWindowOpenHandler(({ url }) => {
    // You can add logic here to allow specific URLs if needed, 
    // but for a streaming app, blocking all popups is usually the best policy.
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
  createWindow();
  
  // Check for updates
  autoUpdater.checkForUpdatesAndNotify().catch(err => log.error('Auto-update error:', err));
  
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
