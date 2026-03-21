import { AI_PROVIDER_IDS, DEFAULT_AI_PROVIDER, getDefaultAiEndpoint } from "../ai/defaults";
import { createAiProviderAdapter } from "../ai/provider-adapters";
import { PlatformSecretStore } from "../ai/platform-secret-store";
import type { AiProviderConfigRecord, AiSettingsRepository } from "../repositories/ai-settings-repository";
import type {
  AiConnectionTestInput,
  AiProviderConfig,
  AiProviderConfigInput,
  AiProviderId,
  AiSettingsInput,
} from "../types";
import { HttpError } from "../utils/http-error";

function assertProvider(provider: string): asserts provider is AiProviderId {
  if (!AI_PROVIDER_IDS.includes(provider as AiProviderId)) {
    throw new HttpError(400, "VALIDATION_ERROR", "provider is invalid");
  }
}

function findConfigByProvider(
  configs: AiProviderConfigRecord[],
  provider: AiProviderId,
) {
  return configs.find((config) => config.provider === provider) ?? null;
}

export class AiSettingsService {
  constructor(
    private readonly aiSettingsRepository: AiSettingsRepository,
    private readonly secretStore: PlatformSecretStore,
  ) {}

  getSettings() {
    const savedConfigs = this.aiSettingsRepository.listProviderConfigs();
    const activeProvider =
      this.aiSettingsRepository.getActiveProvider() ?? DEFAULT_AI_PROVIDER;

    const providers: AiProviderConfig[] = AI_PROVIDER_IDS.map((provider) => {
      const config = findConfigByProvider(savedConfigs, provider);

      return {
        provider,
        endpoint: config?.endpoint || getDefaultAiEndpoint(provider),
        model: config?.model ?? "",
        hasApiKey: Boolean(config?.secretStorage && config?.secretRef),
        updatedAt: config?.updatedAt ?? null,
      };
    });

    return {
      activeProvider,
      providers,
      secretStorage: this.secretStore.getStatus(),
    };
  }

  updateSettings(input: AiSettingsInput) {
    assertProvider(input.activeProvider);

    if (!Array.isArray(input.providers)) {
      throw new HttpError(400, "VALIDATION_ERROR", "providers must be an array");
    }

    const seenProviders = new Set<AiProviderId>();
    const savedConfigs = this.aiSettingsRepository.listProviderConfigs();
    const now = new Date().toISOString();

    for (const providerInput of input.providers) {
      this.validateProviderConfigInput(providerInput);
      seenProviders.add(providerInput.provider);

      const previousConfig = findConfigByProvider(savedConfigs, providerInput.provider);
      let secretStorage = previousConfig?.secretStorage ?? "";
      let secretRef = previousConfig?.secretRef ?? "";

      if (providerInput.clearApiKey) {
        if (previousConfig) {
          this.secretStore.clear(providerInput.provider, {
            storage: previousConfig.secretStorage,
            ref: previousConfig.secretRef,
          });
        }
        secretStorage = "";
        secretRef = "";
      } else if (providerInput.apiKey?.trim()) {
        const savedSecret = this.secretStore.save(
          providerInput.provider,
          providerInput.apiKey.trim(),
        );
        secretStorage = savedSecret.storage;
        secretRef = savedSecret.ref;
      }

      this.aiSettingsRepository.upsertProviderConfig({
        provider: providerInput.provider,
        endpoint: providerInput.endpoint.trim(),
        model: providerInput.model.trim(),
        secretStorage,
        secretRef,
        updatedAt: now,
      });
    }

    for (const provider of AI_PROVIDER_IDS) {
      if (!seenProviders.has(provider)) {
        const previousConfig = findConfigByProvider(savedConfigs, provider);
        this.aiSettingsRepository.upsertProviderConfig({
          provider,
          endpoint: previousConfig?.endpoint || getDefaultAiEndpoint(provider),
          model: previousConfig?.model ?? "",
          secretStorage: previousConfig?.secretStorage ?? "",
          secretRef: previousConfig?.secretRef ?? "",
          updatedAt: previousConfig?.updatedAt ?? now,
        });
      }
    }

    this.aiSettingsRepository.setActiveProvider(input.activeProvider, now);

    return this.getSettings();
  }

  async testConnection(input: AiConnectionTestInput) {
    assertProvider(input.provider);

    const savedConfig = this.aiSettingsRepository.findProviderConfig(input.provider);
    const endpoint =
      input.endpoint?.trim() ||
      savedConfig?.endpoint ||
      getDefaultAiEndpoint(input.provider);
    const model = input.model?.trim() || savedConfig?.model || "";
    const inlineApiKey = input.apiKey?.trim() || "";
    const savedApiKey = savedConfig
      ? this.secretStore.read(input.provider, {
          storage: savedConfig.secretStorage,
          ref: savedConfig.secretRef,
        })
      : null;
    const apiKey = inlineApiKey || savedApiKey || "";

    if (!model) {
      throw new HttpError(400, "VALIDATION_ERROR", "model is required");
    }

    if (!apiKey) {
      throw new HttpError(400, "VALIDATION_ERROR", "apiKey is required");
    }

    if (input.provider === "azure_openai" && !endpoint) {
      throw new HttpError(400, "VALIDATION_ERROR", "endpoint is required");
    }

    const adapter = createAiProviderAdapter(input.provider);
    const result = await adapter.testConnection({
      endpoint,
      model,
      apiKey,
    });

    return {
      ok: true as const,
      message: result.message,
    };
  }

  private validateProviderConfigInput(input: AiProviderConfigInput) {
    assertProvider(input.provider);

    if (typeof input.endpoint !== "string") {
      throw new HttpError(400, "VALIDATION_ERROR", "endpoint must be a string");
    }

    if (typeof input.model !== "string") {
      throw new HttpError(400, "VALIDATION_ERROR", "model must be a string");
    }

    if (input.apiKey !== undefined && typeof input.apiKey !== "string") {
      throw new HttpError(400, "VALIDATION_ERROR", "apiKey must be a string");
    }

    if (input.clearApiKey !== undefined && typeof input.clearApiKey !== "boolean") {
      throw new HttpError(400, "VALIDATION_ERROR", "clearApiKey must be a boolean");
    }

    if (input.endpoint.length > 500) {
      throw new HttpError(400, "VALIDATION_ERROR", "endpoint is too long");
    }

    if (input.model.length > 200) {
      throw new HttpError(400, "VALIDATION_ERROR", "model is too long");
    }
  }
}
