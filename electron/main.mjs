import { app, BrowserWindow, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fork } from "node:child_process";

const host = process.env.HOST ?? "127.0.0.1";
const port = process.env.PORT ?? "8787";
const appUrl = `http://${host}:${port}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devRendererUrl = process.env.ELECTRON_RENDERER_URL ?? "";

let mainWindow = null;
let backendProcess = null;
let quitting = false;

function getAppRoot() {
  return app.getAppPath();
}

function getPreloadPath() {
  return path.join(__dirname, "preload.mjs");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, label) {
  const maxAttempts = 60;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}

    await wait(1000);
  }

  throw new Error(`${label} did not become ready in time.`);
}

async function startBundledBackend() {
  if (backendProcess) {
    return;
  }

  const appRoot = getAppRoot();
  const backendEntry = path.join(appRoot, "backend", "dist", "index.js");
  const frontendDistDir = path.join(appRoot, "frontend", "dist");

  backendProcess = fork(backendEntry, {
    cwd: appRoot,
    env: {
      ...process.env,
      HOST: host,
      PORT: port,
      FRONTEND_DIST_PATH: frontendDistDir,
    },
    stdio: "inherit",
  });

  backendProcess.once("exit", (code) => {
    backendProcess = null;

    if (!quitting && code && code !== 0) {
      const message = `memo4me backend exited unexpectedly with code ${code}.`;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript(
          `document.body.innerHTML = "<pre style=\\"padding:24px;font:14px sans-serif\\">${message}</pre>";`,
        ).catch(() => {});
      }
    }
  });

  await waitForUrl(`${appUrl}/api/health`, "memo4me backend");
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    title: "memo4me",
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (devRendererUrl) {
    await mainWindow.loadURL(devRendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await startBundledBackend();
  await mainWindow.loadURL(appUrl);
}

function stopBundledBackend() {
  if (!backendProcess || backendProcess.killed) {
    return;
  }

  backendProcess.kill("SIGTERM");
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  quitting = true;
  stopBundledBackend();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});

app.whenReady().then(() => createMainWindow()).catch((error) => {
  console.error(error);
  app.exit(1);
});
