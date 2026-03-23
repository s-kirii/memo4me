import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("memo4meDesktop", {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
});
