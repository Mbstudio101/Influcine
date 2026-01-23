import { app, BrowserWindow, session, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    // Frameless window
    backgroundColor: "#0f172a",
    // Dark background to match new theme
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
      // Allow cross-origin for iframes if needed
    }
  });
  const filter = {
    urls: [
      "*://*.doubleclick.net/*",
      "*://*.google-analytics.com/*",
      "*://*.googlesyndication.com/*",
      "*://*.adservice.google.com/*",
      "*://*.adnxs.com/*",
      "*://*.openx.net/*",
      "*://*.popads.net/*",
      "*://*.popcash.net/*",
      "*://*.adroll.com/*",
      "*://*.rubiconproject.com/*",
      "*://*.outbrain.com/*",
      "*://*.taboola.com/*",
      "*://*.zemanta.com/*",
      "*://*.ampproject.org/*",
      "*://*.moatads.com/*",
      "*://*.pubmatic.com/*",
      "*://*.adsafeprotected.com/*",
      "*://*.clickbank.net/*",
      "*://*.clicksor.com/*",
      "*://*.contextweb.com/*",
      "*://*.criteo.com/*",
      "*://*.lijit.com/*",
      "*://*.sovrn.com/*",
      "*://*.adcolony.com/*",
      "*://*.applovin.com/*",
      "*://*.unity3d.com/*",
      "*://*.vungle.com/*",
      "*://*.chartboost.com/*",
      "*://*.inmobi.com/*",
      "*://*.tapjoy.com/*",
      "*://*.ironsrc.com/*",
      "*://*.fyber.com/*",
      "*://*.mintegral.com/*",
      "*://*.pangle.com/*",
      "*://*.facebook.com/tr/*",
      "*://*.facebook.net/*",
      "*://*.hotjar.com/*",
      "*://*.clarity.ms/*"
    ]
  };
  session.defaultSession.webRequest.onBeforeRequest(filter, (_details, callback) => {
    callback({ cancel: true });
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Blocked popup:", url);
    return { action: "deny" };
  });
  ipcMain.on("window-minimize", () => win == null ? void 0 : win.minimize());
  ipcMain.on("window-maximize", () => {
    if (win == null ? void 0 : win.isMaximized()) {
      win.unmaximize();
    } else {
      win == null ? void 0 : win.maximize();
    }
  });
  ipcMain.on("window-close", () => win == null ? void 0 : win.close());
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
