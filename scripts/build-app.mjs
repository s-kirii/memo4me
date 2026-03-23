#!/usr/bin/env node

import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
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

async function main() {
  const npmCommand = getNpmCommand();

  console.log("Building frontend...");
  await runCommand(npmCommand, ["run", "build"], path.join(rootDir, "frontend"));

  console.log("Building backend...");
  await runCommand(npmCommand, ["run", "build"], path.join(rootDir, "backend"));

  console.log("Build completed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Build failed.");
  process.exit(1);
});
