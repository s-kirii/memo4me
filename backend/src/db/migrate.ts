import fs from "node:fs";
import path from "node:path";
import type { AppDatabase } from "./database";

function getMigrationsDir() {
  return path.resolve(__dirname, "..", "..", "migrations");
}

export function runMigrations(db: AppDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrations = fs
    .readdirSync(getMigrationsDir())
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied = new Set<string>(
    (
      db.prepare("SELECT version FROM schema_migrations").all() as Array<{
        version: string;
      }>
    ).map((row) => row.version),
  );

  const insertMigration = db.prepare(`
    INSERT INTO schema_migrations (version, applied_at)
    VALUES (?, ?)
  `);

  for (const migrationFile of migrations) {
    if (applied.has(migrationFile)) {
      continue;
    }

    const sql = fs.readFileSync(
      path.join(getMigrationsDir(), migrationFile),
      "utf8",
    );

    const transaction = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(migrationFile, new Date().toISOString());
    });

    transaction();
  }
}
