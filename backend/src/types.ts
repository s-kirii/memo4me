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

export type AiActionType =
  | "summary"
  | "structure"
  | "extract_action_items"
  | "quick_prompt";

export type AiGenerateTextInput = {
  systemPrompt?: string;
  userPrompt: string;
};

export type AiGenerateTextResult = {
  text: string;
  provider: AiProviderId;
  model: string;
};

export type AiRunNoteInput = {
  action: AiActionType;
  prompt?: string;
};

export type AiOutputItem = {
  id: string;
  noteId: string;
  provider: AiProviderId;
  action: AiActionType;
  model: string;
  contentMd: string;
  createdAt: string;
};

export type AiTaskCandidate = {
  id: string;
  title: string;
};

export type AiExtractTaskCandidatesResult = {
  item: AiOutputItem;
  candidates: AiTaskCandidate[];
};

export type TaskStatus = "open" | "in_progress" | "done";

export type TaskOrigin = "manual" | "ai";

export type TaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  isTodayTask: boolean;
  tags: string[];
  startTargetDate: string | null;
  dueDate: string | null;
  noteText: string | null;
  sourceNoteId: string | null;
  sourceNoteTitle: string | null;
  sourceSelectionText: string | null;
  createdBy: TaskOrigin;
  createdAt: string;
  updatedAt: string;
};

export type TaskInput = {
  title: string;
  status?: TaskStatus;
  isTodayTask?: boolean;
  tags?: string[];
  startTargetDate?: string | null;
  dueDate?: string | null;
  noteText?: string | null;
  sourceNoteId?: string | null;
  sourceSelectionText?: string | null;
  createdBy?: TaskOrigin;
};

export type TaskBulkCreateInput = {
  items: TaskInput[];
};

export type TaskUpdateInput = {
  title?: string;
  status?: TaskStatus;
  isTodayTask?: boolean;
  tags?: string[];
  startTargetDate?: string | null;
  dueDate?: string | null;
  noteText?: string | null;
  sourceNoteId?: string | null;
};
