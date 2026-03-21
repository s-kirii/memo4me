import type { AiProviderId } from "../types";

export const AI_PROVIDER_IDS: AiProviderId[] = [
  "openai_compatible",
  "azure_openai",
  "gemini",
];

export const DEFAULT_AI_PROVIDER: AiProviderId = "openai_compatible";

export function getDefaultAiEndpoint(provider: AiProviderId) {
  switch (provider) {
    case "openai_compatible":
      return "https://api.openai.com/v1";
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta";
    case "azure_openai":
    default:
      return "";
  }
}

export function getProviderLabel(provider: AiProviderId) {
  switch (provider) {
    case "openai_compatible":
      return "OpenAI-compatible";
    case "azure_openai":
      return "Azure OpenAI";
    case "gemini":
      return "Gemini";
  }
}
