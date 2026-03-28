#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRootDir = path.join(rootDir, "dist-electron");
const buildLockPath = path.join(distRootDir, ".electron-build.lock");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
);
const appVersion = packageJson.version;
const electronVersion = String(
  packageJson.devDependencies?.electron ?? "",
).replace(/^[^\d]*/, "");

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function moveEntry(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  ensureDir(path.dirname(targetPath));
  fs.renameSync(sourcePath, targetPath);
}

function moveToVersionDir(version, entryName, targetName = entryName) {
  const sourcePath = path.join(distRootDir, entryName);
  const targetPath = path.join(distRootDir, `v${version}`, targetName);
  moveEntry(sourcePath, targetPath);
}

function parseVersionFromArtifact(fileName) {
  const match = fileName.match(/^memo4me-(\d+\.\d+\.\d+)-/);
  return match?.[1] ?? null;
}

function migrateExistingArtifacts() {
  ensureDir(distRootDir);
  const rootEntries = fs.readdirSync(distRootDir);
  const knownVersions = new Set();

  for (const entryName of rootEntries) {
    const version = parseVersionFromArtifact(entryName);
    if (!version) {
      continue;
    }

    knownVersions.add(version);
    moveToVersionDir(version, entryName);
  }

  if (knownVersions.size === 0) {
    return;
  }

  const latestVersion = [...knownVersions].sort(compareVersions).at(-1);
  if (!latestVersion) {
    return;
  }

  const genericEntries = [
    "mac-arm64",
    "win-arm64-unpacked",
    "win-unpacked",
    "builder-debug.yml",
    "builder-effective-config.yaml",
    "latest.yml",
  ];

  for (const entryName of genericEntries) {
    moveToVersionDir(latestVersion, entryName);
  }
}

function organizeCurrentBuild(targetPlatform, targetArch) {
  ensureDir(path.join(distRootDir, `v${appVersion}`));

  if (targetPlatform === "darwin") {
    moveToVersionDir(appVersion, "mac-arm64");
    moveToVersionDir(appVersion, `memo4me-${appVersion}-mac-${targetArch}.dmg`);
  }

  if (targetPlatform === "win32") {
    const unpackedDir = targetArch === "arm64" ? "win-arm64-unpacked" : "win-unpacked";
    moveToVersionDir(appVersion, unpackedDir);
    moveToVersionDir(appVersion, `memo4me-${appVersion}-win-${targetArch}.exe`);
    moveToVersionDir(appVersion, `memo4me-${appVersion}-win-${targetArch}.exe.blockmap`);
    moveToVersionDir(appVersion, "latest.yml", `latest-${targetArch}.yml`);
  }

  const metadataDir = path.join(distRootDir, `v${appVersion}`, "metadata", `${targetPlatform}-${targetArch}`);
  moveEntry(path.join(distRootDir, "builder-debug.yml"), path.join(metadataDir, "builder-debug.yml"));
  moveEntry(
    path.join(distRootDir, "builder-effective-config.yaml"),
    path.join(metadataDir, "builder-effective-config.yaml"),
  );
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      ...options,
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? 1}`));
    });
  });
}

function resolveTargetArch(cliArgs) {
  if (cliArgs.includes("--x64")) {
    return "x64";
  }

  if (cliArgs.includes("--arm64")) {
    return "arm64";
  }

  return process.arch;
}

function resolveTargetPlatform(cliArgs) {
  if (cliArgs.includes("--win")) {
    return "win32";
  }

  if (cliArgs.includes("--mac")) {
    return "darwin";
  }

  return process.platform;
}

async function main() {
  ensureDir(path.dirname(buildLockPath));
  migrateExistingArtifacts();

  if (fs.existsSync(buildLockPath)) {
    throw new Error(
      "Another electron build is already running. Run desktop builds sequentially, not in parallel.",
    );
  }

  fs.writeFileSync(
    buildLockPath,
    JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      args: process.argv.slice(2),
    }),
  );

  await run(process.execPath, [path.join(rootDir, "scripts", "build-app.mjs")]);

  const builderBinary = path.join(
    rootDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron-builder.cmd" : "electron-builder",
  );

  const cliArgs = process.argv.slice(2);
  const targetArch = resolveTargetArch(cliArgs);
  const targetPlatform = resolveTargetPlatform(cliArgs);
  const builderArgs =
    cliArgs.length > 0
      ? [...cliArgs, "--publish", "never"]
      : process.platform === "darwin"
        ? ["--mac", "--publish", "never"]
      : process.platform === "win32"
          ? ["--win", "--publish", "never"]
          : ["--dir", "--publish", "never"];

  try {
    await run("npm", ["rebuild", "better-sqlite3"], {
      cwd: path.join(rootDir, "backend"),
      env: {
        ...process.env,
        npm_config_runtime: "electron",
        npm_config_target: electronVersion,
        npm_config_arch: targetArch,
        npm_config_platform: targetPlatform,
        npm_config_disturl: "https://electronjs.org/headers",
        npm_config_build_from_source: "false",
        npm_config_fallback_to_build: "false",
        npm_config_update_binary: "true",
      },
    });

    await run(builderBinary, builderArgs);
    organizeCurrentBuild(targetPlatform, targetArch);
  } finally {
    await run("npm", ["rebuild", "better-sqlite3"], {
      cwd: path.join(rootDir, "backend"),
    }).catch((error) => {
      console.error(
        error instanceof Error
          ? `Failed to restore backend better-sqlite3 for system Node: ${error.message}`
        : "Failed to restore backend better-sqlite3 for system Node.",
      );
    });

    if (fs.existsSync(buildLockPath)) {
      fs.rmSync(buildLockPath);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Electron build failed.");
  process.exit(1);
});
