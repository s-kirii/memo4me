import { getDefaultAiEndpoint, getProviderLabel } from "./defaults";
import { HttpError } from "../utils/http-error";
import type { AiProviderId } from "../types";

type AiConnectionConfig = {
  endpoint: string;
  model: string;
  apiKey: string;
};

type AiProviderAdapter = {
  testConnection(config: AiConnectionConfig): Promise<{ message: string }>;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

async function postJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);

  if (!response.ok) {
    const responseText = await response.text();
    let providerMessage = responseText.trim();

    try {
      const parsed = JSON.parse(responseText) as {
        error?: { message?: string };
        message?: string;
      };
      providerMessage =
        parsed.error?.message ?? parsed.message ?? providerMessage;
    } catch {
      // Keep raw response text when JSON parsing fails.
    }

    throw new HttpError(
      502,
      "AI_CONNECTION_FAILED",
      providerMessage || "provider rejected the connection test request",
    );
  }
}

class OpenAiCompatibleAdapter implements AiProviderAdapter {
  async testConnection(config: AiConnectionConfig) {
    const endpoint = trimTrailingSlash(
      config.endpoint || getDefaultAiEndpoint("openai_compatible"),
    );

    await postJson(`${endpoint}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: "Reply with OK only.",
        max_output_tokens: 16,
      }),
    });

    return {
      message: `${getProviderLabel("openai_compatible")} connection succeeded.`,
    };
  }
}

class AzureOpenAiAdapter implements AiProviderAdapter {
  async testConnection(config: AiConnectionConfig) {
    const endpoint = trimTrailingSlash(config.endpoint);

    await postJson(`${endpoint}/responses`, {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: "Reply with OK only.",
        max_output_tokens: 16,
      }),
    });

    return {
      message: `${getProviderLabel("azure_openai")} connection succeeded.`,
    };
  }
}

class GeminiAdapter implements AiProviderAdapter {
  async testConnection(config: AiConnectionConfig) {
    const endpoint = trimTrailingSlash(
      config.endpoint || getDefaultAiEndpoint("gemini"),
    );

    await postJson(
      `${endpoint}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: "Reply with OK only." }],
            },
          ],
        }),
      },
    );

    return {
      message: `${getProviderLabel("gemini")} connection succeeded.`,
    };
  }
}

export function createAiProviderAdapter(provider: AiProviderId): AiProviderAdapter {
  switch (provider) {
    case "openai_compatible":
      return new OpenAiCompatibleAdapter();
    case "azure_openai":
      return new AzureOpenAiAdapter();
    case "gemini":
      return new GeminiAdapter();
  }
}
