import type { AppDatabase } from "../db/database";
import type { AiApiCompatibilityMode, AiProviderId } from "../types";

type AiSettingsRow = {
  active_provider: AiProviderId;
};

export type AiProviderConfigRecord = {
  provider: AiProviderId;
  endpoint: string;
  model: string;
  compatibilityMode: AiApiCompatibilityMode;
  secretStorage: "" | "keychain" | "dpapi";
  secretRef: string;
  updatedAt: string;
};

type AiProviderConfigRow = {
  provider: AiProviderId;
  endpoint: string;
  model: string;
  api_compatibility_mode: AiApiCompatibilityMode;
  secret_storage: "" | "keychain" | "dpapi";
  secret_ref: string;
  updated_at: string;
};

export class AiSettingsRepository {
  constructor(private readonly db: AppDatabase) {}

  getActiveProvider() {
    const row = this.db
      .prepare("SELECT active_provider FROM ai_settings WHERE id = 1")
      .get() as AiSettingsRow | undefined;

    return row?.active_provider ?? null;
  }

  setActiveProvider(activeProvider: AiProviderId, updatedAt: string) {
    this.db
      .prepare(
        `
        INSERT INTO ai_settings (id, active_provider, updated_at)
        VALUES (1, @activeProvider, @updatedAt)
        ON CONFLICT(id) DO UPDATE
        SET active_provider = excluded.active_provider,
            updated_at = excluded.updated_at
        `,
      )
      .run({
        activeProvider,
        updatedAt,
      });
  }

  listProviderConfigs() {
    const rows = this.db
      .prepare(
        `
        SELECT provider, endpoint, model, api_compatibility_mode, secret_storage, secret_ref, updated_at
        FROM ai_provider_configs
        ORDER BY provider ASC
        `,
      )
      .all() as AiProviderConfigRow[];

    return rows.map((row) => this.mapRow(row));
  }

  findProviderConfig(provider: AiProviderId) {
    const row = this.db
      .prepare(
        `
        SELECT provider, endpoint, model, api_compatibility_mode, secret_storage, secret_ref, updated_at
        FROM ai_provider_configs
        WHERE provider = ?
        LIMIT 1
        `,
      )
      .get(provider) as AiProviderConfigRow | undefined;

    return row ? this.mapRow(row) : null;
  }

  upsertProviderConfig(record: AiProviderConfigRecord) {
    this.db
      .prepare(
        `
        INSERT INTO ai_provider_configs (
          provider,
          endpoint,
          model,
          api_compatibility_mode,
          secret_storage,
          secret_ref,
          updated_at
        )
        VALUES (
          @provider,
          @endpoint,
          @model,
          @compatibilityMode,
          @secretStorage,
          @secretRef,
          @updatedAt
        )
        ON CONFLICT(provider) DO UPDATE
        SET endpoint = excluded.endpoint,
            model = excluded.model,
            api_compatibility_mode = excluded.api_compatibility_mode,
            secret_storage = excluded.secret_storage,
            secret_ref = excluded.secret_ref,
            updated_at = excluded.updated_at
        `,
      )
      .run(record);
  }

  private mapRow(row: AiProviderConfigRow): AiProviderConfigRecord {
    return {
      provider: row.provider,
      endpoint: row.endpoint,
      model: row.model,
      compatibilityMode: row.api_compatibility_mode,
      secretStorage: row.secret_storage,
      secretRef: row.secret_ref,
      updatedAt: row.updated_at,
    };
  }
}
