import { app, BrowserWindow, ipcMain, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const host = process.env.HOST ?? "127.0.0.1";
const port = process.env.PORT ?? "8787";
const appUrl = `http://${host}:${port}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devRendererUrl = process.env.ELECTRON_RENDERER_URL ?? "";

let mainWindow = null;
let backendProcess = null;
let quitting = false;
const backendLogBuffer = [];

function getDesktopLogPath() {
  const baseDir = app.isReady()
    ? path.join(app.getPath("userData"), "logs")
    : path.join(process.cwd(), ".memo4me-logs");
  return path.join(baseDir, "memo4me-desktop.log");
}

function logDesktop(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;

  try {
    const desktopLogPath = getDesktopLogPath();
    fs.mkdirSync(path.dirname(desktopLogPath), { recursive: true });
    fs.appendFileSync(desktopLogPath, line);
  } catch {}
}

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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getRecentBackendLogs() {
  return backendLogBuffer.slice(-20).join("\n");
}

async function showWindowMessage(title, body) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const html = `<!doctype html>
  <html lang="ja">
    <body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#faf6ef;color:#2f241c;">
      <h1 style="margin:0 0 16px;font-size:28px;">${escapeHtml(title)}</h1>
      <pre style="white-space:pre-wrap;word-break:break-word;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;background:#fffaf4;border:1px solid #e4d8ca;border-radius:16px;padding:16px;">${escapeHtml(body)}</pre>
    </body>
  </html>`;
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function startBundledBackend() {
  if (backendProcess) {
    logDesktop("backend already running, skipping start");
    return;
  }

  const appRoot = getAppRoot();
  const backendEntry = path.join(appRoot, "backend", "dist", "index.js");
  const frontendDistDir = path.join(appRoot, "frontend", "dist");

  logDesktop(`appRoot=${appRoot}`);
  logDesktop(`backendEntry=${backendEntry}`);
  logDesktop(`frontendDistDir=${frontendDistDir}`);

  backendProcess = spawn(process.execPath, [backendEntry], {
    cwd: appRoot,
    windowsHide: true,
    env: {
      ...process.env,
      HOST: host,
      PORT: port,
      FRONTEND_DIST_PATH: frontendDistDir,
      ELECTRON_RUN_AS_NODE: "1",
    },
  });

  logDesktop(`spawned backend pid=${backendProcess.pid ?? "unknown"}`);

  backendProcess.stdout?.on("data", (chunk) => {
    const line = String(chunk).trim();
    backendLogBuffer.push(`stdout: ${line}`);
    logDesktop(`backend stdout: ${line}`);
    process.stdout.write(chunk);
  });

  backendProcess.stderr?.on("data", (chunk) => {
    const line = String(chunk).trim();
    backendLogBuffer.push(`stderr: ${line}`);
    logDesktop(`backend stderr: ${line}`);
    process.stderr.write(chunk);
  });

  backendProcess.once("error", (error) => {
    logDesktop(`backend error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    console.error("memo4me backend failed to start:", error);
  });

  backendProcess.once("exit", (code) => {
    logDesktop(`backend exit code=${code ?? "null"}`);
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

  await Promise.race([
    waitForUrl(`${appUrl}/api/health`, "memo4me backend"),
    new Promise((_, reject) => {
      backendProcess?.once("exit", (code) => {
        reject(new Error(`memo4me backend exited before ready (code: ${code ?? "null"})`));
      });
    }),
  ]);
}

async function createMainWindow() {
  logDesktop("createMainWindow called");
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

  mainWindow.webContents.on("console-message", (_event, level, message) => {
    logDesktop(`renderer console[level=${level}]: ${message}`);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logDesktop(`renderer gone: ${JSON.stringify(details)}`);
  });

  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    logDesktop(`did-fail-load code=${code} description=${description} url=${url}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (devRendererUrl) {
    logDesktop(`loading dev renderer: ${devRendererUrl}`);
    await mainWindow.loadURL(devRendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await showWindowMessage("memo4me を起動しています", "backend を起動中です。しばらくお待ちください。");

  try {
    await startBundledBackend();
    logDesktop(`loading app url: ${appUrl}`);
    await mainWindow.loadURL(appUrl);
  } catch (error) {
    const desktopLogPath = getDesktopLogPath();
    const message =
      error instanceof Error ? error.message : "memo4me backend failed to start.";
    logDesktop(`startup display error: ${message}`);
    await showWindowMessage(
      "memo4me の起動に失敗しました",
      `${message}\n\nLog file:\n${desktopLogPath}\n\nRecent backend logs:\n${getRecentBackendLogs() || "(no backend logs)"}`,
    );
  }
}

function stopBundledBackend() {
  if (!backendProcess || backendProcess.killed) {
    return;
  }

  backendProcess.kill("SIGTERM");
}

ipcMain.handle("memo4me:quit-app", () => {
  app.quit();
  return { ok: true };
});

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
  logDesktop(`app startup failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  console.error(error);
  app.exit(1);
});
