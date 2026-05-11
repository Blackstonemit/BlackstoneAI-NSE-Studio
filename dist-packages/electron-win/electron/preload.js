/**
 * Preload script — runs in isolated context before the renderer.
 * Exposes a minimal safe API to the renderer process.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  onServerReady: (callback) => ipcRenderer.on("server-ready", callback),
  onServerError: (callback) => ipcRenderer.on("server-error", (_, msg) => callback(msg)),
});
