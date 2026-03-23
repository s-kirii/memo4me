#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
);
const electronVersion = String(
  packageJson.devDependencies?.electron ?? "",
).replace(/^[^\d]*/, "");

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

async function main() {
  await run(process.execPath, [path.join(rootDir, "scripts", "build-app.mjs")]);

  const builderBinary = path.join(
    rootDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron-builder.cmd" : "electron-builder",
  );

  const cliArgs = process.argv.slice(2);
  const targetArch = resolveTargetArch(cliArgs);
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
        npm_config_disturl: "https://electronjs.org/headers",
      },
    });

    await run(builderBinary, builderArgs);
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
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Electron build failed.");
  process.exit(1);
});
