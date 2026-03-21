import { useEffect, useMemo, useState } from "react";
import { AiTaskCandidatesModal } from "./AiTaskCandidatesModal";

type AiActionType =
  | "summary"
  | "structure"
  | "extract_action_items"
  | "quick_prompt";

type AiProviderId = "openai_compatible" | "azure_openai" | "gemini";

type AiOutputItem = {
  id: string;
  noteId: string;
  provider: AiProviderId;
  action: AiActionType;
  model: string;
  contentMd: string;
  createdAt: string;
};

type AiTaskCandidate = {
  id: string;
  title: string;
};

type AiAssistantModalProps = {
  isOpen: boolean;
  note: {
    id: string;
    title: string;
    contentMd: string;
  } | null;
  onClose: () => void;
  onApplyToNote: (contentMd: string) => void;
  onCreateNoteFromOutput: (title: string, contentMd: string) => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const ACTION_OPTIONS: Array<{ id: AiActionType; label: string }> = [
  { id: "summary", label: "Summarize" },
  { id: "structure", label: "Structure" },
  { id: "extract_action_items", label: "Action items" },
  { id: "quick_prompt", label: "Quick prompt" },
];

const ACTION_DESCRIPTIONS: Record<AiActionType, string> = {
  summary: "Create a concise summary for the current note.",
  structure: "Rewrite the note into cleaner sections and bullets.",
  extract_action_items:
    "Extract concrete task candidates and review them before saving.",
  quick_prompt: "Run a custom prompt against the current note context.",
};

function formatDateTime(value: string) {
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

function getOutputTitle(action: AiActionType) {
  switch (action) {
    case "summary":
      return "Summary";
    case "structure":
      return "Structured note";
    case "extract_action_items":
      return "Action items";
    case "quick_prompt":
    default:
      return "Quick prompt result";
  }
}

function getProviderLabel(provider: AiProviderId) {
  switch (provider) {
    case "openai_compatible":
      return "OpenAI-compatible";
    case "azure_openai":
      return "Azure OpenAI";
    case "gemini":
      return "Gemini";
  }
}

function formatAiErrorMessage(message: string) {
  if (/api key is required/i.test(message)) {
    return "API key が未設定です。AI Settings で選択中 provider の API key を保存してください。";
  }

  if (/model is required/i.test(message)) {
    return "モデルが未設定です。AI Settings で選択中 provider の model を設定してください。";
  }

  if (/endpoint is required/i.test(message)) {
    return "endpoint が未設定です。AI Settings で provider の接続先を設定してください。";
  }

  if (/AI request failed/i.test(message) || /AI_CONNECTION_FAILED/i.test(message)) {
    return `AI 呼び出しに失敗しました。AI Settings の provider / model / endpoint / API key を確認してください。詳細: ${message}`;
  }

  return message;
}

function normalizeTaskLine(line: string) {
  if (!/^(\s*[-*+]\s+(\[(?: |x|X)\]\s+)?.+|\s*\d+\.\s+.+)$/.test(line)) {
    return "";
  }

  return line
    .trim()
    .replace(/^[-*+]\s+\[(?: |x|X)\]\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .trim();
}

function parseTaskCandidatesFromMarkdown(contentMd: string): AiTaskCandidate[] {
  const uniqueTitles = new Set<string>();

  return contentMd
    .split("\n")
    .map((line) => normalizeTaskLine(line))
    .filter(Boolean)
    .filter((line) => !/^no clear action items\.?$/i.test(line))
    .filter((line) => {
      const normalized = line.toLowerCase();
      if (uniqueTitles.has(normalized)) {
        return false;
      }

      uniqueTitles.add(normalized);
      return true;
    })
    .map((title, index) => ({
      id: `${title}-${index}`,
      title,
    }));
}

export function AiAssistantModal({
  isOpen,
  note,
  onClose,
  onApplyToNote,
  onCreateNoteFromOutput,
  request,
}: AiAssistantModalProps) {
  const [history, setHistory] = useState<AiOutputItem[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<AiActionType>("summary");
  const [quickPrompt, setQuickPrompt] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingNewNote, setIsSavingNewNote] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [taskCandidates, setTaskCandidates] = useState<AiTaskCandidate[]>([]);
  const [isTaskCandidatesOpen, setIsTaskCandidatesOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<AiActionType | "all">("all");

  useEffect(() => {
    if (!isOpen || !note) {
      return;
    }

    let cancelled = false;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      try {
        const response = await request<{ items: AiOutputItem[] }>(
          `/notes/${note.id}/ai-outputs`,
        );

        if (cancelled) {
          return;
        }

        setHistory(response.items);
        setSelectedOutputId(response.items[0]?.id ?? null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? formatAiErrorMessage(error.message)
            : "failed to load AI history",
        );
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [isOpen, note, request]);

  const selectedOutput = useMemo(
    () => history.find((item) => item.id === selectedOutputId) ?? history[0] ?? null,
    [history, selectedOutputId],
  );
  const filteredHistory = useMemo(
    () =>
      historyFilter === "all"
        ? history
        : history.filter((item) => item.action === historyFilter),
    [history, historyFilter],
  );
  const derivedTaskCandidates = useMemo(
    () =>
      selectedOutput?.action === "extract_action_items"
        ? parseTaskCandidatesFromMarkdown(selectedOutput.contentMd)
        : [],
    [selectedOutput],
  );

  if (!isOpen || !note) {
    return null;
  }

  const handleRun = async () => {
    setIsRunning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (selectedAction === "extract_action_items") {
        const response = await request<{
          item: AiOutputItem;
          candidates: AiTaskCandidate[];
        }>(`/notes/${note.id}/ai/task-candidates`, {
          method: "POST",
        });

        setHistory((currentHistory) => [response.item, ...currentHistory]);
        setSelectedOutputId(response.item.id);
        setTaskCandidates(response.candidates);
        setIsTaskCandidatesOpen(true);
        setSuccessMessage(
          response.candidates.length > 0
            ? `${response.candidates.length} task candidates generated.`
            : "No clear AI task candidates were found.",
        );
      } else {
        const response = await request<{ item: AiOutputItem }>(
          `/notes/${note.id}/ai/run`,
          {
            method: "POST",
            body: JSON.stringify({
              action: selectedAction,
              prompt: selectedAction === "quick_prompt" ? quickPrompt : undefined,
            }),
          },
        );

        setHistory((currentHistory) => [response.item, ...currentHistory]);
        setSelectedOutputId(response.item.id);
        setSuccessMessage(`${getOutputTitle(response.item.action)} generated.`);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? formatAiErrorMessage(error.message)
          : "failed to run AI action",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = async () => {
    if (!selectedOutput) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedOutput.contentMd);
      setSuccessMessage("Copied to clipboard.");
      setErrorMessage(null);
    } catch {
      setErrorMessage("failed to copy to clipboard");
    }
  };

  const handleSaveAsNewNote = async () => {
    if (!selectedOutput) {
      return;
    }

    setIsSavingNewNote(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const titleSuffix =
        selectedOutput.action === "summary"
          ? "Summary"
          : selectedOutput.action === "structure"
            ? "Structured"
            : selectedOutput.action === "extract_action_items"
              ? "Action items"
              : "AI result";
      const noteTitle = `${note.title.trim() || "Untitled"} - ${titleSuffix}`;

      await onCreateNoteFromOutput(noteTitle, selectedOutput.contentMd);
      setSuccessMessage("Saved as a new note.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? formatAiErrorMessage(error.message)
          : "failed to save as a new note",
      );
    } finally {
      setIsSavingNewNote(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card ai-assistant-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-assistant-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">AI</p>
            <h2 id="ai-assistant-title">AI Assistant</h2>
            <p className="modal-description">
              Run note-aware AI actions, review the result, then apply or save it.
            </p>
          </div>
          <button type="button" className="ghost-button modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="ai-assistant-layout">
          <section className="ai-assistant-sidebar">
            <div className="modal-section">
              <div className="section-heading">
                <h3>Actions</h3>
                <p>Select how AI should help with this note.</p>
              </div>
              <div className="provider-pill-row">
                {ACTION_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`provider-pill${
                      selectedAction === option.id ? " is-active" : ""
                    }`}
                    onClick={() => {
                      setSelectedAction(option.id);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="inline-note">{ACTION_DESCRIPTIONS[selectedAction]}</p>

              {selectedAction === "quick_prompt" ? (
                <label className="field">
                  <span>Prompt</span>
                  <textarea
                    className="ai-prompt-textarea"
                    value={quickPrompt}
                    onChange={(event) => setQuickPrompt(event.target.value)}
                    placeholder="Ask AI to rewrite, classify, or inspect this note."
                  />
                </label>
              ) : null}

              <button
                type="button"
                className="primary-button"
                onClick={() => void handleRun()}
                disabled={
                  isRunning ||
                  (selectedAction === "quick_prompt" && !quickPrompt.trim())
                }
              >
                {isRunning ? "Running..." : "Run"}
              </button>
            </div>

            <div className="modal-section ai-history-section">
              <div className="section-heading">
                <h3>History</h3>
                <p>Outputs are saved per note.</p>
              </div>
              <label className="field">
                <span>Filter</span>
                <select
                  value={historyFilter}
                  onChange={(event) =>
                    setHistoryFilter(event.target.value as AiActionType | "all")
                  }
                >
                  <option value="all">All actions</option>
                  {ACTION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ai-history-list">
                {isLoadingHistory ? (
                  <div className="list-empty">Loading AI history...</div>
                ) : filteredHistory.length === 0 ? (
                  <div className="list-empty">No AI outputs for this filter</div>
                ) : (
                  filteredHistory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`ai-history-item${
                        item.id === selectedOutput?.id ? " is-selected" : ""
                      }`}
                      onClick={() => setSelectedOutputId(item.id)}
                    >
                      <strong>{getOutputTitle(item.action)}</strong>
                      <span>{getProviderLabel(item.provider)}</span>
                      <span>{item.model}</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="ai-output-panel">
            <div className="ai-output-header">
              <div>
                <p className="eyebrow">Result</p>
                <h3>{selectedOutput ? getOutputTitle(selectedOutput.action) : "No output yet"}</h3>
                {selectedOutput ? (
                  <p className="inline-note">
                    {getProviderLabel(selectedOutput.provider)} / {selectedOutput.model} /{" "}
                    {formatDateTime(selectedOutput.createdAt)}
                  </p>
                ) : null}
              </div>
              <div className="editor-meta-actions">
                {selectedOutput?.action === "extract_action_items" ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setTaskCandidates(derivedTaskCandidates);
                      setIsTaskCandidatesOpen(true);
                    }}
                    disabled={derivedTaskCandidates.length === 0}
                  >
                    Review task candidates
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => selectedOutput && onApplyToNote(selectedOutput.contentMd)}
                  disabled={!selectedOutput}
                >
                  Apply to note
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleSaveAsNewNote()}
                  disabled={!selectedOutput || isSavingNewNote}
                >
                  {isSavingNewNote ? "Saving..." : "Save as new note"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleCopy()}
                  disabled={!selectedOutput}
                >
                  Copy
                </button>
              </div>
            </div>

            {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
            {successMessage ? <p className="success-banner">{successMessage}</p> : null}

            <div className="ai-output-card">
              {selectedOutput ? (
                <pre className="ai-output-content">{selectedOutput.contentMd}</pre>
              ) : (
                <div className="list-empty">
                  Run an AI action to generate the first result.
                </div>
              )}
            </div>
          </section>
        </div>
        <AiTaskCandidatesModal
          isOpen={isTaskCandidatesOpen}
          noteId={note.id}
          noteTitle={note.title}
          candidates={taskCandidates}
          onClose={() => setIsTaskCandidatesOpen(false)}
          onSaved={(items) => {
            setSuccessMessage(`${items.length} AI tasks saved.`);
          }}
          request={request}
        />
      </div>
    </div>
  );
}
