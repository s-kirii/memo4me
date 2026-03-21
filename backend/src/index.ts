import { config } from "./config";
import { createDatabase } from "./db/database";
import { runMigrations } from "./db/migrate";
import { createApp } from "./app";

const db = createDatabase();
runMigrations(db);

const app = createApp(db);

app.listen(config.port, config.host, () => {
  console.log(`memo4me backend listening on http://${config.host}:${config.port}`);
  console.log(`memo4me database path: ${config.dbPath}`);
});
