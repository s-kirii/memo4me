import type { Server } from "node:http";
import { config } from "./config";
import { createDatabase } from "./db/database";
import { runMigrations } from "./db/migrate";
import { createApp } from "./app";

const db = createDatabase();
runMigrations(db);

let server: Server | null = null;
const app = createApp(db, {
  onShutdown: () => {
    if (!server) {
      process.exit(0);
      return;
    }

    server.close(() => {
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(0);
    }, 1000).unref();
  },
});

server = app.listen(config.port, config.host, () => {
  console.log(`memo4me backend listening on http://${config.host}:${config.port}`);
  console.log(`memo4me database path: ${config.dbPath}`);
});
