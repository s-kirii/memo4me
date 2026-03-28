import { getDefaultAiEndpoint, getProviderLabel } from "./defaults";
import { HttpError } from "../utils/http-error";
import type {
  AiApiCompatibilityMode,
  AiGenerateTextInput,
  AiGenerateTextResult,
  AiProviderId,
} from "../types";

export type AiProviderRequestConfig = {
  endpoint: string;
  model: string;
  compatibilityMode: AiApiCompatibilityMode;
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
        fault?: { faultstring?: string };
        message?: string;
      };
      providerMessage =
        parsed.error?.message ??
        parsed.fault?.faultstring ??
        parsed.message ??
        providerMessage;
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

function extractResponsesText(response: {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
}) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text ?? "")
      .join("\n") ?? ""
  );
}

function buildCompatibilitySuccessMessage(
  provider: AiProviderId,
  compatibilityMode: AiApiCompatibilityMode,
) {
  if (compatibilityMode === "responses") {
    return `${getProviderLabel(provider)} connection succeeded. responses 互換で接続できました。`;
  }

  if (compatibilityMode === "chat_completions") {
    return `${getProviderLabel(provider)} connection succeeded. chat/completions 互換で接続できました。`;
  }

  return `${getProviderLabel(provider)} connection succeeded.`;
}

async function testOpenAiCompatibleWithResponses(
  endpoint: string,
  apiKey: string,
  model: string,
) {
  await postJson(`${endpoint}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: "Reply with OK only.",
      max_output_tokens: 16,
    }),
  });
}

async function testOpenAiCompatibleWithChatCompletions(
  endpoint: string,
  apiKey: string,
  model: string,
) {
  await postJson(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with OK only." }],
      max_tokens: 16,
      temperature: 0,
    }),
  });
}

async function generateOpenAiCompatibleWithResponses(
  endpoint: string,
  apiKey: string,
  model: string,
  input: AiGenerateTextInput,
) {
  const response = await postJson<{
    output_text?: string;
    output?: Array<{
      content?: Array<{ text?: string; type?: string }>;
    }>;
  }>(`${endpoint}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: input.systemPrompt,
      input: input.userPrompt,
      temperature: 0.2,
    }),
  });

  return extractResponsesText(response);
}

async function generateOpenAiCompatibleWithChatCompletions(
  endpoint: string,
  apiKey: string,
  model: string,
  input: AiGenerateTextInput,
) {
  const response = await postJson<{
    choices?: Array<{ message?: { content?: string } }>;
  }>(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(input.systemPrompt
          ? [{ role: "system", content: input.systemPrompt }]
          : []),
        { role: "user", content: input.userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  return response.choices?.[0]?.message?.content ?? "";
}

async function testAzureWithResponses(
  endpoint: string,
  apiKey: string,
  model: string,
) {
  await postJson(`${endpoint}/responses`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: "Reply with OK only.",
      max_output_tokens: 16,
    }),
  });
}

async function testAzureWithChatCompletions(
  endpoint: string,
  apiKey: string,
  model: string,
) {
  await postJson(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with OK only." }],
      max_tokens: 16,
      temperature: 0,
    }),
  });
}

async function generateAzureWithResponses(
  endpoint: string,
  apiKey: string,
  model: string,
  input: AiGenerateTextInput,
) {
  const response = await postJson<{
    output_text?: string;
    output?: Array<{
      content?: Array<{ text?: string; type?: string }>;
    }>;
  }>(`${endpoint}/responses`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: input.systemPrompt,
      input: input.userPrompt,
      temperature: 0.2,
    }),
  });

  return extractResponsesText(response);
}

async function generateAzureWithChatCompletions(
  endpoint: string,
  apiKey: string,
  model: string,
  input: AiGenerateTextInput,
) {
  const response = await postJson<{
    choices?: Array<{ message?: { content?: string } }>;
  }>(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(input.systemPrompt
          ? [{ role: "system", content: input.systemPrompt }]
          : []),
        { role: "user", content: input.userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  return response.choices?.[0]?.message?.content ?? "";
}

class OpenAiCompatibleAdapter implements AiProviderAdapter {
  async testConnection(config: AiProviderRequestConfig) {
    const endpoint = trimTrailingSlash(
      config.endpoint || getDefaultAiEndpoint("openai_compatible"),
    );
    const mode = config.compatibilityMode;

    if (mode === "responses") {
      await testOpenAiCompatibleWithResponses(endpoint, config.apiKey, config.model);
      return {
        message: buildCompatibilitySuccessMessage(
          "openai_compatible",
          "responses",
        ),
      };
    }

    if (mode === "chat_completions") {
      await testOpenAiCompatibleWithChatCompletions(
        endpoint,
        config.apiKey,
        config.model,
      );
      return {
        message: buildCompatibilitySuccessMessage(
          "openai_compatible",
          "chat_completions",
        ),
      };
    }

    try {
      await testOpenAiCompatibleWithResponses(endpoint, config.apiKey, config.model);
      return {
        message: buildCompatibilitySuccessMessage(
          "openai_compatible",
          "responses",
        ),
      };
    } catch (responsesError) {
      try {
        await testOpenAiCompatibleWithChatCompletions(
          endpoint,
          config.apiKey,
          config.model,
        );
        return {
          message: buildCompatibilitySuccessMessage(
            "openai_compatible",
            "chat_completions",
          ),
        };
      } catch (chatError) {
        if (chatError instanceof HttpError) {
          throw new HttpError(
            502,
            "AI_CONNECTION_FAILED",
            `responses 互換と chat/completions 互換の両方で接続に失敗しました。responses: ${
              responsesError instanceof Error ? responsesError.message : "unknown error"
            } / chat: ${chatError.message}`,
          );
        }

        throw chatError;
      }
    }
  }

  async generateText(
    config: AiProviderRequestConfig,
    input: AiGenerateTextInput,
  ) {
    const endpoint = trimTrailingSlash(
      config.endpoint || getDefaultAiEndpoint("openai_compatible"),
    );
    const mode = config.compatibilityMode;

    if (mode === "responses") {
      return normalizeGeneratedText(
        await generateOpenAiCompatibleWithResponses(
          endpoint,
          config.apiKey,
          config.model,
          input,
        ),
        "openai_compatible",
        config.model,
      );
    }

    if (mode === "chat_completions") {
      return normalizeGeneratedText(
        await generateOpenAiCompatibleWithChatCompletions(
          endpoint,
          config.apiKey,
          config.model,
          input,
        ),
        "openai_compatible",
        config.model,
      );
    }

    try {
      return normalizeGeneratedText(
        await generateOpenAiCompatibleWithChatCompletions(
          endpoint,
          config.apiKey,
          config.model,
          input,
        ),
        "openai_compatible",
        config.model,
      );
    } catch (chatError) {
      try {
        return normalizeGeneratedText(
          await generateOpenAiCompatibleWithResponses(
            endpoint,
            config.apiKey,
            config.model,
            input,
          ),
          "openai_compatible",
          config.model,
        );
      } catch (responsesError) {
        if (responsesError instanceof HttpError) {
          throw new HttpError(
            502,
            "AI_CONNECTION_FAILED",
            `chat/completions 互換と responses 互換の両方で AI 呼び出しに失敗しました。chat: ${
              chatError instanceof Error ? chatError.message : "unknown error"
            } / responses: ${responsesError.message}`,
          );
        }

        throw responsesError;
      }
    }
  }
}

class AzureOpenAiAdapter implements AiProviderAdapter {
  async testConnection(config: AiProviderRequestConfig) {
    const endpoint = trimTrailingSlash(config.endpoint);
    const mode = config.compatibilityMode;

    if (mode === "responses") {
      await testAzureWithResponses(endpoint, config.apiKey, config.model);
      return {
        message: buildCompatibilitySuccessMessage("azure_openai", "responses"),
      };
    }

    if (mode === "chat_completions") {
      await testAzureWithChatCompletions(endpoint, config.apiKey, config.model);
      return {
        message: buildCompatibilitySuccessMessage(
          "azure_openai",
          "chat_completions",
        ),
      };
    }

    try {
      await testAzureWithResponses(endpoint, config.apiKey, config.model);
      return {
        message: buildCompatibilitySuccessMessage("azure_openai", "responses"),
      };
    } catch (responsesError) {
      try {
        await testAzureWithChatCompletions(endpoint, config.apiKey, config.model);
        return {
          message: buildCompatibilitySuccessMessage(
            "azure_openai",
            "chat_completions",
          ),
        };
      } catch (chatError) {
        if (chatError instanceof HttpError) {
          throw new HttpError(
            502,
            "AI_CONNECTION_FAILED",
            `responses 互換と chat/completions 互換の両方で接続に失敗しました。responses: ${
              responsesError instanceof Error ? responsesError.message : "unknown error"
            } / chat: ${chatError.message}`,
          );
        }

        throw chatError;
      }
    }
  }

  async generateText(
    config: AiProviderRequestConfig,
    input: AiGenerateTextInput,
  ) {
    const endpoint = trimTrailingSlash(config.endpoint);
    const mode = config.compatibilityMode;

    if (mode === "responses") {
      return normalizeGeneratedText(
        await generateAzureWithResponses(
          endpoint,
          config.apiKey,
          config.model,
          input,
        ),
        "azure_openai",
        config.model,
      );
    }

    if (mode === "chat_completions") {
      return normalizeGeneratedText(
        await generateAzureWithChatCompletions(
          endpoint,
          config.apiKey,
          config.model,
          input,
        ),
        "azure_openai",
        config.model,
      );
    }

    try {
      return normalizeGeneratedText(
        await generateAzureWithChatCompletions(
          endpoint,
          config.apiKey,
          config.model,
          input,
        ),
        "azure_openai",
        config.model,
      );
    } catch (chatError) {
      try {
        return normalizeGeneratedText(
          await generateAzureWithResponses(
            endpoint,
            config.apiKey,
            config.model,
            input,
          ),
          "azure_openai",
          config.model,
        );
      } catch (responsesError) {
        if (responsesError instanceof HttpError) {
          throw new HttpError(
            502,
            "AI_CONNECTION_FAILED",
            `chat/completions 互換と responses 互換の両方で AI 呼び出しに失敗しました。chat: ${
              chatError instanceof Error ? chatError.message : "unknown error"
            } / responses: ${responsesError.message}`,
          );
        }

        throw responsesError;
      }
    }
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
