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
  resolveMetaAd: (url) => ipcRenderer.invoke("meta:resolveAd", url),
});
