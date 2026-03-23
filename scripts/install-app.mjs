#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findChromePath } from "./chrome-launcher.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontendDir = path.join(rootDir, "frontend");
const backendDir = path.join(rootDir, "backend");
const frontendNodeModules = path.join(frontendDir, "node_modules");
const backendNodeModules = path.join(backendDir, "node_modules");
const frontendManifestPaths = [
  path.join(frontendDir, "package.json"),
  path.join(frontendDir, "package-lock.json"),
];
const backendManifestPaths = [
  path.join(backendDir, "package.json"),
  path.join(backendDir, "package-lock.json"),
];

function getCommandName(baseCommand) {
  return process.platform === "win32" ? `${baseCommand}.cmd` : baseCommand;
}

function resolveCommand(command, args) {
  if (process.platform === "win32" && command.toLowerCase().endsWith(".cmd")) {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", command, ...args],
    };
  }

  return { command, args };
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const next = resolveCommand(command, args);
    const child = spawn(next.command, next.args, {
      cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

function ensureCommandExists(command) {
  return new Promise((resolve, reject) => {
    const resolvedCommand =
      command === "node"
        ? { command: process.execPath, args: ["--version"] }
        : resolveCommand(getCommandName(command), ["--version"]);

    const checker = spawn(resolvedCommand.command, resolvedCommand.args, {
      stdio: "ignore",
      shell: false,
    });

    checker.on("error", () => {
      reject(new Error(`${command} is required but was not found.`));
    });

    checker.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} is required but was not found.`));
    });
  });
}

function getLatestTimestamp(paths) {
  return paths.reduce((latest, targetPath) => {
    if (!fs.existsSync(targetPath)) {
      return latest;
    }

    return Math.max(latest, fs.statSync(targetPath).mtimeMs);
  }, 0);
}

function shouldInstallDependencies(nodeModulesPath, manifestPaths) {
  if (!fs.existsSync(nodeModulesPath)) {
    return true;
  }

  const nodeModulesTimestamp = fs.statSync(nodeModulesPath).mtimeMs;
  const manifestTimestamp = getLatestTimestamp(manifestPaths);

  return manifestTimestamp > nodeModulesTimestamp;
}

async function installDependenciesIfNeeded() {
  const npmCommand = getCommandName("npm");

  if (shouldInstallDependencies(frontendNodeModules, frontendManifestPaths)) {
    console.log("Installing frontend dependencies...");
    await runCommand(npmCommand, ["install"], frontendDir);
  } else {
    console.log("Frontend dependencies already exist. Skipping.");
  }

  if (shouldInstallDependencies(backendNodeModules, backendManifestPaths)) {
    console.log("Installing backend dependencies...");
    await runCommand(npmCommand, ["install"], backendDir);
  } else {
    console.log("Backend dependencies already exist. Skipping.");
  }
}

async function rebuildApp() {
  console.log("Running production build to sync the latest source changes...");
  await runCommand(process.execPath, [path.join(rootDir, "scripts", "build-app.mjs")], rootDir);
}

async function main() {
  console.log("Checking required tools...");
  await ensureCommandExists("node");
  await ensureCommandExists("npm");

  console.log("Checking Google Chrome...");
  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error("Chrome is required but was not found.");
  }
  console.log(`Chrome found at: ${chromePath}`);

  await installDependenciesIfNeeded();
  await rebuildApp();

  console.log("");
  console.log("memo4me setup completed.");
  console.log("Start the app with:");
  console.log("  node scripts/start-app.mjs");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Setup failed.");
  process.exit(1);
});
