#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDistEntry = path.join(rootDir, "backend", "dist", "index.js");
const frontendDistDir = path.join(rootDir, "frontend", "dist");
const frontendIndexHtml = path.join(frontendDistDir, "index.html");
const host = process.env.HOST ?? "127.0.0.1";
const port = process.env.PORT ?? "8787";
const appUrl = `http://${host}:${port}`;

let backendProcess = null;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function cleanup(exitCode = 0) {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }

  process.exit(exitCode);
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

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`${label} did not become ready in time.`);
}

async function openChrome() {
  const launcherPath = path.join(rootDir, "scripts", "chrome-launcher.mjs");

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [launcherPath, "open", appUrl], {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || "Chrome is required but was not found."));
    });
  });
}

async function main() {
  if (!fs.existsSync(backendDistEntry)) {
    fail("backend build output was not found. Run `node scripts/build-app.mjs` first.");
  }

  if (!fs.existsSync(frontendIndexHtml)) {
    fail("frontend build output was not found. Run `node scripts/build-app.mjs` first.");
  }

  backendProcess = spawn(process.execPath, [backendDistEntry], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      HOST: host,
      PORT: port,
      FRONTEND_DIST_PATH: frontendDistDir,
    },
  });

  backendProcess.on("exit", (code) => {
    if (code !== 0) {
      console.error(`backend exited with code ${code}`);
    }
  });

  await waitForUrl(`${appUrl}/api/health`, "Backend");
  await waitForUrl(appUrl, "App");
  await openChrome();

  console.log(`memo4me production app is running at ${appUrl}`);
  console.log("Press Ctrl+C to stop.");
}

process.on("SIGINT", () => cleanup(0));
process.on("SIGTERM", () => cleanup(0));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to start app.");
  cleanup(1);
});
