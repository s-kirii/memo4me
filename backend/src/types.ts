export type NoteListItem = {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type NoteDetail = {
  id: string;
  title: string;
  contentMd: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type TagItem = {
  id: string;
  name: string;
};

export type NoteInput = {
  title: string;
  contentMd: string;
  tags: string[];
};

export type ListNotesParams = {
  q?: string;
  tag?: string;
  sort?: string;
};

export type AiProviderId =
  | "openai_compatible"
  | "azure_openai"
  | "gemini";

export type AiProviderConfig = {
  provider: AiProviderId;
  endpoint: string;
  model: string;
  hasApiKey: boolean;
  updatedAt: string | null;
};

export type AiSecretStorageStatus = {
  strategy: "keychain" | "dpapi" | "unsupported";
  supported: boolean;
  note: string;
};

export type AiSettings = {
  activeProvider: AiProviderId;
  providers: AiProviderConfig[];
  secretStorage: AiSecretStorageStatus;
};

export type AiProviderConfigInput = {
  provider: AiProviderId;
  endpoint: string;
  model: string;
  apiKey?: string;
  clearApiKey?: boolean;
};

export type AiSettingsInput = {
  activeProvider: AiProviderId;
  providers: AiProviderConfigInput[];
};

export type AiConnectionTestInput = {
  provider: AiProviderId;
  endpoint?: string;
  model?: string;
  apiKey?: string;
};
