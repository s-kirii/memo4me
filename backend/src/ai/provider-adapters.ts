import { getDefaultAiEndpoint, getProviderLabel } from "./defaults";
import { HttpError } from "../utils/http-error";
import type {
  AiGenerateTextInput,
  AiGenerateTextResult,
  AiProviderId,
} from "../types";

export type AiProviderRequestConfig = {
  endpoint: string;
  model: string;
  apiKey: string;
};

export type AiProviderAdapter = {
  testConnection(config: AiProviderRequestConfig): Promise<{ message: string }>;
  generateText(
    config: AiProviderRequestConfig,
    input: AiGenerateTextInput,
  ): Promise<AiGenerateTextResult>;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

async function postJson<T>(url: string, init: RequestInit): Promise<T> {
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

  return (await response.json()) as T;
}

function normalizeGeneratedText(text: string, provider: AiProviderId, model: string) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new HttpError(
      502,
      "AI_CONNECTION_FAILED",
      `${getProviderLabel(provider)} returned an empty response`,
    );
  }

  return {
    text: normalizedText,
    provider,
    model,
  };
}

class OpenAiCompatibleAdapter implements AiProviderAdapter {
  async testConnection(config: AiProviderRequestConfig) {
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

  async generateText(
    config: AiProviderRequestConfig,
    input: AiGenerateTextInput,
  ) {
    const endpoint = trimTrailingSlash(
      config.endpoint || getDefaultAiEndpoint("openai_compatible"),
    );

    const response = await postJson<{
      choices?: Array<{ message?: { content?: string } }>;
    }>(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          ...(input.systemPrompt
            ? [{ role: "system", content: input.systemPrompt }]
            : []),
          { role: "user", content: input.userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    return normalizeGeneratedText(
      response.choices?.[0]?.message?.content ?? "",
      "openai_compatible",
      config.model,
    );
  }
}

class AzureOpenAiAdapter implements AiProviderAdapter {
  async testConnection(config: AiProviderRequestConfig) {
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

  async generateText(
    config: AiProviderRequestConfig,
    input: AiGenerateTextInput,
  ) {
    const endpoint = trimTrailingSlash(config.endpoint);

    const response = await postJson<{
      choices?: Array<{ message?: { content?: string } }>;
    }>(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          ...(input.systemPrompt
            ? [{ role: "system", content: input.systemPrompt }]
            : []),
          { role: "user", content: input.userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    return normalizeGeneratedText(
      response.choices?.[0]?.message?.content ?? "",
      "azure_openai",
      config.model,
    );
  }
}

class GeminiAdapter implements AiProviderAdapter {
  async testConnection(config: AiProviderRequestConfig) {
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

  async generateText(
    config: AiProviderRequestConfig,
    input: AiGenerateTextInput,
  ) {
    const endpoint = trimTrailingSlash(
      config.endpoint || getDefaultAiEndpoint("gemini"),
    );

    const prompt = input.systemPrompt
      ? `${input.systemPrompt}\n\n${input.userPrompt}`
      : input.userPrompt;

    const response = await postJson<{
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    }>(
      `${endpoint}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      },
    );

    const text =
      response.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("\n") ?? "";

    return normalizeGeneratedText(text, "gemini", config.model);
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
