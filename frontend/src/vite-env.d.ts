/// <reference types="vite/client" />

interface Memo4meDesktopBridge {
  isElectron: boolean;
  platform: string;
  version: string;
  quitApp: () => Promise<{ ok: true }>;
}

interface Window {
  memo4meDesktop?: Memo4meDesktopBridge;
}
