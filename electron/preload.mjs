import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("memo4meDesktop", {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  quitApp: () => ipcRenderer.invoke("memo4me:quit-app"),
  getUpdateState: () => ipcRenderer.invoke("memo4me:get-update-state"),
  checkForUpdates: () => ipcRenderer.invoke("memo4me:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("memo4me:download-update"),
  quitAndInstallUpdate: () => ipcRenderer.invoke("memo4me:quit-and-install-update"),
  onUpdateStateChanged: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on("memo4me:update-state-changed", handler);
    return () => {
      ipcRenderer.removeListener("memo4me:update-state-changed", handler);
    };
  },
});
