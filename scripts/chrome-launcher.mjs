#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function getPlatform() {
  return process.env.MEMO4ME_CHROME_PLATFORM || process.platform;
}

function getCommandOutput(command, args, envKey) {
  const overriddenOutput = process.env[envKey];
  if (typeof overriddenOutput === "string") {
    return overriddenOutput;
  }

  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) {
    return "";
  }

  return result.stdout;
}

function isExecutable(filePath) {
  if (!filePath) {
    return false;
  }

  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function uniq(items) {
  return [...new Set(items.filter(Boolean))];
}

function getWindowsChromeCandidates() {
  const env = process.env;

  const fixedCandidates = uniq([
    env.ProgramFiles
      ? path.join(env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe")
      : "",
    env["ProgramFiles(x86)"]
      ? path.join(
          env["ProgramFiles(x86)"],
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        )
      : "",
    env.LocalAppData
      ? path.join(env.LocalAppData, "Google", "Chrome", "Application", "chrome.exe")
      : "",
  ]);

  const whereOutput = getCommandOutput(
    "where",
    ["chrome.exe"],
    "MEMO4ME_CHROME_WHERE_OUTPUT",
  );
  const pathCandidates = whereOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return [...fixedCandidates, ...pathCandidates];
}

function getMacChromeCandidates() {
  const homeDir = process.env.HOME || os.homedir();

  const fixedCandidates = uniq([
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    path.join(
      homeDir,
      "Applications",
      "Google Chrome.app",
      "Contents",
      "MacOS",
      "Google Chrome",
    ),
  ]);

  const mdfindOutput = getCommandOutput(
    "mdfind",
    ["kMDItemCFBundleIdentifier == 'com.google.Chrome'"],
    "MEMO4ME_CHROME_MDFIND_OUTPUT",
  );

  const spotlightCandidates = mdfindOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((appPath) => path.join(appPath, "Contents", "MacOS", "Google Chrome"));

  return [...fixedCandidates, ...spotlightCandidates];
}

function getLinuxChromeCandidates() {
  const candidates = [];

  for (const commandName of ["google-chrome", "chrome", "chromium", "chromium-browser"]) {
    const output = getCommandOutput("which", [commandName], "MEMO4ME_CHROME_WHICH_OUTPUT");
    const filePath = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (filePath) {
      candidates.push(filePath);
    }
  }

  return uniq(candidates);
}

export function findChromePath() {
  const platform = getPlatform();
  const candidates =
    platform === "win32"
      ? getWindowsChromeCandidates()
      : platform === "darwin"
        ? getMacChromeCandidates()
        : getLinuxChromeCandidates();

  for (const candidate of candidates) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function openUrlInChrome(url) {
  const chromePath = findChromePath();

  if (!chromePath) {
    throw new Error("Chrome is required but was not found.");
  }

  const child = spawn(chromePath, [url], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return chromePath;
}

function printUsage() {
  console.error("Usage:");
  console.error("  node scripts/chrome-launcher.mjs find");
  console.error("  node scripts/chrome-launcher.mjs open <url>");
}

function runCli() {
  const [command, url] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exit(1);
  }

  if (command === "find") {
    const chromePath = findChromePath();
    if (!chromePath) {
      console.error("Chrome is required but was not found.");
      process.exit(1);
    }

    console.log(chromePath);
    process.exit(0);
  }

  if (command === "open") {
    if (!url) {
      printUsage();
      process.exit(1);
    }

    try {
      const chromePath = openUrlInChrome(url);
      console.log(`Chrome path resolved: ${chromePath}`);
      process.exit(0);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Chrome is required but was not found.";
      console.error(message);
      process.exit(1);
    }
  }

  printUsage();
  process.exit(1);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  runCli();
}
