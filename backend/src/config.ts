import os from "node:os";
import path from "node:path";

function getDefaultDataDir() {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "memo4me");
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      return path.join(appData, "memo4me");
    }
  }

  return path.join(os.homedir(), ".local", "share", "memo4me");
}

export const config = {
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 8787),
  dbPath: process.env.DB_PATH ?? path.join(getDefaultDataDir(), "app.db"),
  corsOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"],
};
