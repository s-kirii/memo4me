#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");
const electronBinary = path.join(
  rootDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron.cmd" : "electron",
);

const children = [];

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function spawnChild(command, args, options) {
  const child = spawn(command, args, {
    stdio: "inherit",
    ...options,
  });

  children.push(child);
  return child;
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

function killChild(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
    });
    return;
  }

  child.kill("SIGTERM");
}

function cleanup(exitCode = 0) {
  for (const child of children) {
    killChild(child);
  }

  setTimeout(() => process.exit(exitCode), 200).unref();
}

async function main() {
  spawnChild(npmCommand(), ["run", "dev"], {
    cwd: backendDir,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: "8787",
    },
  });

  spawnChild(npmCommand(), ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: frontendDir,
    env: process.env,
  });

  await waitForUrl("http://127.0.0.1:8787/api/health", "Backend");
  await waitForUrl("http://127.0.0.1:5173", "Frontend");

  const electronProcess = spawnChild(electronBinary, ["."], {
    cwd: rootDir,
    env: Object.fromEntries(
      Object.entries({
        ...process.env,
        ELECTRON_RENDERER_URL: "http://127.0.0.1:5173",
        HOST: "127.0.0.1",
        PORT: "8787",
      }).filter(([key]) => key !== "ELECTRON_RUN_AS_NODE"),
    ),
  });

  electronProcess.once("exit", (code) => {
    cleanup(code ?? 0);
  });
}

process.on("SIGINT", () => cleanup(0));
process.on("SIGTERM", () => cleanup(0));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to start Electron dev.");
  cleanup(1);
});
