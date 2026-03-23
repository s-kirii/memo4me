import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("memo4meDesktop", {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  quitApp: () => ipcRenderer.invoke("memo4me:quit-app"),
});
