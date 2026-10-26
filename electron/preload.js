// Runs in an isolated context with access to Node APIs, but the renderer
// only ever sees whatever is explicitly exposed here via contextBridge --
// no direct Node/Electron access is ever given to the web page itself.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  platform: process.platform,
  models: {
    check: () => ipcRenderer.invoke("models:check"),
    ensure: () => ipcRenderer.invoke("models:ensure"),
    onProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("models:progress", handler);
      return () => ipcRenderer.removeListener("models:progress", handler);
    },
  },
  chooseFolder: () => ipcRenderer.invoke("dialog:chooseFolder"),
  defaultDownloadDir: () => ipcRenderer.invoke("dialog:defaultDownloadDir"),
  openLogsFolder: () => ipcRenderer.invoke("dialog:openLogsFolder"),
  resolveMetaAd: (url) => ipcRenderer.invoke("meta:resolveAd", url),
  // Competitor Ad Research: structured search results for the native ad
  // grid, from a hidden BrowserWindow (never shown to the user) that loads
  // the real facebook.com/ads/library page and reads its embedded JSON --
  // see electron/main.js's meta:searchAds handler. Only ever the first
  // batch Meta's page renders server-side.
  searchMetaAds: (url) => ipcRenderer.invoke("meta:searchAds", url),
  // Pagination beyond that first batch -- a session is a kept-alive hidden
  // window; start() loads the page and readies it, more() scrolls it and
  // returns whatever new ads were found (possibly none), stop() releases
  // it. See the "Pagination beyond the first batch" comment in main.js.
  searchMetaAdsSession: {
    start: (url) => ipcRenderer.invoke("meta:searchSession:start", url),
    more: (sessionId) => ipcRenderer.invoke("meta:searchSession:more", sessionId),
    stop: (sessionId) => ipcRenderer.invoke("meta:searchSession:stop", sessionId),
  },
  notifyTaskComplete: (message) => ipcRenderer.invoke("notification:taskComplete", message),
  // Ads bookmarked from the native Competitor Ad Research grid.
  bookmarks: {
    list: () => ipcRenderer.invoke("bookmarks:list"),
    toggle: (payload) => ipcRenderer.invoke("bookmarks:toggle", payload),
    remove: (adArchiveId) => ipcRenderer.invoke("bookmarks:remove", adArchiveId),
    onChanged: (callback) => {
      const handler = (_event, entries) => callback(entries);
      ipcRenderer.on("bookmarks:changed", handler);
      return () => ipcRenderer.removeListener("bookmarks:changed", handler);
    },
  },
  library: {
    list: () => ipcRenderer.invoke("library:list"),
    upsert: (entry) => ipcRenderer.invoke("library:upsert", entry),
    remove: (id, options) => ipcRenderer.invoke("library:remove", id, options),
    rename: (id, newBaseName) => ipcRenderer.invoke("library:rename", id, newBaseName),
    openFile: (filePath) => ipcRenderer.invoke("library:openFile", filePath),
    openFolder: (filePath) => ipcRenderer.invoke("library:openFolder", filePath),
    scanFolders: (folders) => ipcRenderer.invoke("library:scanFolders", folders),
    onChanged: (callback) => {
      const handler = (_event, entries) => callback(entries);
      ipcRenderer.on("library:changed", handler);
      return () => ipcRenderer.removeListener("library:changed", handler);
    },
  },
  // Deliberately just these three verbs, not the autoUpdater instance or
  // any other Electron internal -- the renderer only ever gets to ask for
  // a check/download/install and listen for state, same minimal-surface
  // pattern as every other bridge method here.
  updater: {
    checkNow: () => ipcRenderer.invoke("updater:checkNow"),
    downloadUpdate: () => ipcRenderer.invoke("updater:downloadUpdate"),
    quitAndInstall: () => ipcRenderer.invoke("updater:quitAndInstall"),
    onState: (callback) => {
      const handler = (_event, state) => callback(state);
      ipcRenderer.on("updater:state", handler);
      return () => ipcRenderer.removeListener("updater:state", handler);
    },
  },
});
