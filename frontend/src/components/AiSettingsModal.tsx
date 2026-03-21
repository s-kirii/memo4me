import { useEffect, useMemo, useState } from "react";

type AiProviderId = "openai_compatible" | "azure_openai" | "gemini";

type AiProviderConfig = {
  provider: AiProviderId;
  endpoint: string;
  model: string;
  hasApiKey: boolean;
  updatedAt: string | null;
};

type AiSettingsResponse = {
  activeProvider: AiProviderId;
  providers: AiProviderConfig[];
  secretStorage: {
    strategy: "keychain" | "dpapi" | "unsupported";
    supported: boolean;
    note: string;
  };
};

type ProviderDraft = {
  endpoint: string;
  model: string;
  apiKey: string;
  hasApiKey: boolean;
  clearApiKey: boolean;
  updatedAt: string | null;
};

type ProviderOption = {
  id: AiProviderId;
  label: string;
  endpointLabel: string;
  endpointPlaceholder: string;
  modelLabel: string;
  modelPlaceholder: string;
};

type AiSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: "openai_compatible",
    label: "OpenAI-compatible",
    endpointLabel: "Base URL",
    endpointPlaceholder: "https://api.openai.com/v1",
    modelLabel: "Model",
    modelPlaceholder: "gpt-4.1-mini",
  },
  {
    id: "azure_openai",
    label: "Azure OpenAI",
    endpointLabel: "Endpoint",
    endpointPlaceholder: "https://<resource>.openai.azure.com/openai/v1",
    modelLabel: "Deployment / model",
    modelPlaceholder: "my-gpt-deployment",
  },
  {
    id: "gemini",
    label: "Gemini",
    endpointLabel: "Base URL",
    endpointPlaceholder: "https://generativelanguage.googleapis.com/v1beta",
    modelLabel: "Model",
    modelPlaceholder: "gemini-2.0-flash",
  },
];

function createEmptyDraft(): Record<AiProviderId, ProviderDraft> {
  return {
    openai_compatible: {
      endpoint: "",
      model: "",
      apiKey: "",
      hasApiKey: false,
      clearApiKey: false,
      updatedAt: null,
    },
    azure_openai: {
      endpoint: "",
      model: "",
      apiKey: "",
      hasApiKey: false,
      clearApiKey: false,
      updatedAt: null,
    },
    gemini: {
      endpoint: "",
      model: "",
      apiKey: "",
      hasApiKey: false,
      clearApiKey: false,
      updatedAt: null,
    },
  };
}

function applySettingsToDrafts(settings: AiSettingsResponse) {
  const nextDrafts = createEmptyDraft();

  for (const providerConfig of settings.providers) {
    nextDrafts[providerConfig.provider] = {
      endpoint: providerConfig.endpoint,
      model: providerConfig.model,
      apiKey: "",
      hasApiKey: providerConfig.hasApiKey,
      clearApiKey: false,
      updatedAt: providerConfig.updatedAt,
    };
  }

  return nextDrafts;
}

function formatUpdatedAt(value: string | null) {
  if (!value) {
    return "Never saved";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AiSettingsModal({
  isOpen,
  onClose,
  request,
}: AiSettingsModalProps) {
  const [settings, setSettings] = useState<AiSettingsResponse | null>(null);
  const [drafts, setDrafts] = useState(createEmptyDraft);
  const [selectedProvider, setSelectedProvider] =
    useState<AiProviderId>("openai_compatible");
  const [activeProvider, setActiveProvider] =
    useState<AiProviderId>("openai_compatible");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setSaveMessage(null);
      setTestMessage(null);

      try {
        const response = await request<AiSettingsResponse>("/ai/settings");
        if (cancelled) {
          return;
        }

        setSettings(response);
        setDrafts(applySettingsToDrafts(response));
        setActiveProvider(response.activeProvider);
        setSelectedProvider(response.activeProvider);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "failed to load AI settings",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [isOpen, request]);

  const selectedDraft = drafts[selectedProvider];
  const selectedOption = useMemo(
    () =>
      PROVIDER_OPTIONS.find((option) => option.id === selectedProvider) ??
      PROVIDER_OPTIONS[0],
    [selectedProvider],
  );

  if (!isOpen) {
    return null;
  }

  const updateSelectedDraft = (patch: Partial<ProviderDraft>) => {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [selectedProvider]: {
        ...currentDrafts[selectedProvider],
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);

    try {
      const response = await request<AiSettingsResponse>("/ai/settings", {
        method: "PUT",
        body: JSON.stringify({
          activeProvider,
          providers: PROVIDER_OPTIONS.map((option) => {
            const draft = drafts[option.id];
            return {
              provider: option.id,
              endpoint: draft.endpoint,
              model: draft.model,
              apiKey: draft.apiKey || undefined,
              clearApiKey: draft.clearApiKey,
            };
          }),
        }),
      });

      setSettings(response);
      setDrafts(applySettingsToDrafts(response));
      setSaveMessage("AI settings saved.");
      setTestMessage(null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "failed to save AI settings",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setErrorMessage(null);
    setSaveMessage(null);
    setTestMessage(null);

    try {
      const response = await request<{ ok: true; message: string }>(
        "/ai/settings/test",
        {
          method: "POST",
          body: JSON.stringify({
            provider: selectedProvider,
            endpoint: selectedDraft.endpoint,
            model: selectedDraft.model,
            apiKey: selectedDraft.apiKey || undefined,
          }),
        },
      );

      setTestMessage(response.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "connection test failed",
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card ai-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">AI</p>
            <h2 id="ai-settings-title">AI Settings</h2>
            <p className="modal-description">
              Configure local AI providers before enabling note summary and task
              extraction features.
            </p>
          </div>
          <button type="button" className="ghost-button modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        {isLoading ? (
          <div className="modal-loading">Loading AI settings...</div>
        ) : (
          <>
            <section className="modal-section">
              <div className="section-heading">
                <h3>Active provider</h3>
                <p>Choose the provider used by upcoming AI actions by default.</p>
              </div>
              <div className="provider-pill-row">
                {PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`provider-pill${
                      activeProvider === option.id ? " is-active" : ""
                    }`}
                    onClick={() => setActiveProvider(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="modal-section">
              <div className="section-heading">
                <h3>Provider configs</h3>
                <p>Each provider keeps its own endpoint, model, and API key.</p>
              </div>
              <div className="provider-tab-row">
                {PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`provider-tab${
                      selectedProvider === option.id ? " is-active" : ""
                    }`}
                    onClick={() => {
                      setSelectedProvider(option.id);
                      setErrorMessage(null);
                      setSaveMessage(null);
                      setTestMessage(null);
                    }}
                  >
                    <span>{option.label}</span>
                    <span className="provider-tab-meta">
                      {drafts[option.id].hasApiKey && !drafts[option.id].clearApiKey
                        ? "key saved"
                        : "not configured"}
                    </span>
                  </button>
                ))}
              </div>

              <div className="provider-form-card">
                <div className="provider-form-head">
                  <div>
                    <h4>{selectedOption.label}</h4>
                    <p>Last updated: {formatUpdatedAt(selectedDraft.updatedAt)}</p>
                  </div>
                  <span
                    className={`provider-state-pill${
                      selectedDraft.hasApiKey && !selectedDraft.clearApiKey
                        ? " is-ready"
                        : ""
                    }`}
                  >
                    {selectedDraft.hasApiKey && !selectedDraft.clearApiKey
                      ? "API key saved"
                      : "API key missing"}
                  </span>
                </div>

                <div className="ai-field-grid">
                  <label className="field">
                    <span>{selectedOption.endpointLabel}</span>
                    <input
                      type="text"
                      value={selectedDraft.endpoint}
                      onChange={(event) =>
                        updateSelectedDraft({ endpoint: event.target.value })
                      }
                      placeholder={selectedOption.endpointPlaceholder}
                    />
                  </label>

                  <label className="field">
                    <span>{selectedOption.modelLabel}</span>
                    <input
                      type="text"
                      value={selectedDraft.model}
                      onChange={(event) =>
                        updateSelectedDraft({ model: event.target.value })
                      }
                      placeholder={selectedOption.modelPlaceholder}
                    />
                  </label>
                </div>

                <label className="field">
                  <span>API key</span>
                  <input
                    type="password"
                    value={selectedDraft.apiKey}
                    onChange={(event) =>
                      updateSelectedDraft({
                        apiKey: event.target.value,
                        clearApiKey: false,
                      })
                    }
                    placeholder={
                      selectedDraft.hasApiKey && !selectedDraft.clearApiKey
                        ? "Saved locally. Enter only to replace."
                        : "Paste a provider API key"
                    }
                  />
                </label>

                <div className="inline-note-row">
                  <span className="inline-note">{settings?.secretStorage.note}</span>
                  {selectedDraft.hasApiKey ? (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        updateSelectedDraft({
                          apiKey: "",
                          hasApiKey: false,
                          clearApiKey: true,
                        })
                      }
                    >
                      Clear saved key
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
            {saveMessage ? <p className="success-banner">{saveMessage}</p> : null}
            {testMessage ? <p className="success-banner">{testMessage}</p> : null}

            <div className="modal-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => void handleTestConnection()}
                disabled={isTesting || isSaving}
              >
                {isTesting ? "Testing..." : "Test connection"}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleSave()}
                disabled={isSaving || isLoading}
              >
                {isSaving ? "Saving..." : "Save AI settings"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
