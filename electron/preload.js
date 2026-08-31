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
  notifyTaskComplete: (message) => ipcRenderer.invoke("notification:taskComplete", message),
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
});
