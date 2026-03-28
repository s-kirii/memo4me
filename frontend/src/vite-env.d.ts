/// <reference types="vite/client" />

interface Memo4meDesktopBridge {
  isElectron: boolean;
  platform: string;
  version: string;
  quitApp: () => Promise<{ ok: true }>;
  getUpdateState: () => Promise<Memo4meUpdateState>;
  checkForUpdates: () => Promise<Memo4meUpdateState>;
  downloadUpdate: () => Promise<Memo4meUpdateState>;
  quitAndInstallUpdate: () => Promise<{ ok: true }>;
  onUpdateStateChanged: (
    callback: (state: Memo4meUpdateState) => void,
  ) => () => void;
}

interface Memo4meUpdateState {
  supported: boolean;
  enabled: boolean;
  status:
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error"
    | "unsupported";
  currentVersion: string;
  targetVersion: string | null;
  progressPercent: number | null;
  message: string;
  lastCheckedAt: string | null;
}

interface Window {
  memo4meDesktop?: Memo4meDesktopBridge;
}
