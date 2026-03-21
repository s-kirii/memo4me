import { useEffect, useMemo, useState } from "react";
import { AiTaskCandidatesModal } from "./AiTaskCandidatesModal";
import { MarkdownPreview } from "./MarkdownPreview";

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

type AiSettingsResponse = {
  activeProvider: AiProviderId;
  providers: Array<{
    provider: AiProviderId;
    endpoint: string;
    model: string;
    hasApiKey: boolean;
    updatedAt: string | null;
  }>;
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
  { id: "summary", label: "要約" },
  { id: "structure", label: "構造化" },
  { id: "extract_action_items", label: "タスク抽出" },
  { id: "quick_prompt", label: "自由入力" },
];

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
      return "要約";
    case "structure":
      return "構造化メモ";
    case "extract_action_items":
      return "タスク抽出";
    case "quick_prompt":
    default:
      return "自由入力の結果";
  }
}

function getProviderLabel(provider: AiProviderId) {
  switch (provider) {
    case "openai_compatible":
      return "OpenAI互換";
    case "azure_openai":
      return "Azure OpenAI";
    case "gemini":
      return "Gemini";
  }
}

function formatAiErrorMessage(message: string) {
  if (/api key is required/i.test(message)) {
    return "APIキーが未設定です。AI設定で選択中プロバイダの APIキー を保存してください。";
  }

  if (/model is required/i.test(message)) {
    return "モデルが未設定です。AI設定で選択中プロバイダのモデルを設定してください。";
  }

  if (/endpoint is required/i.test(message)) {
    return "エンドポイントが未設定です。AI設定でプロバイダの接続先を設定してください。";
  }

  if (/AI request failed/i.test(message) || /AI_CONNECTION_FAILED/i.test(message)) {
    return `AI 呼び出しに失敗しました。AI設定のプロバイダ / モデル / エンドポイント / APIキー を確認してください。詳細: ${message}`;
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
  const [settings, setSettings] = useState<AiSettingsResponse | null>(null);
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
        const [response, settingsResponse] = await Promise.all([
          request<{ items: AiOutputItem[] }>(`/notes/${note.id}/ai-outputs`),
          request<AiSettingsResponse>("/ai/settings"),
        ]);

        if (cancelled) {
          return;
        }

        setHistory(response.items);
        setSettings(settingsResponse);
        setSelectedOutputId(response.items[0]?.id ?? null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? formatAiErrorMessage(error.message)
            : "AI履歴の読み込みに失敗しました",
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
  const activeProviderConfig = useMemo(
    () =>
      settings?.providers.find((item) => item.provider === settings.activeProvider) ?? null,
    [settings],
  );
  const activeModelLabel = activeProviderConfig?.model.trim() || "未設定";
  const activeProviderLabel = settings
    ? getProviderLabel(settings.activeProvider)
    : "未設定";

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
            ? `${response.candidates.length} 件のタスク候補を作成しました。`
            : "明確なタスク候補は見つかりませんでした。",
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
        setSuccessMessage(`${getOutputTitle(response.item.action)}を作成しました。`);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? formatAiErrorMessage(error.message)
          : "AIの実行に失敗しました",
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
      setSuccessMessage("クリップボードにコピーしました。");
      setErrorMessage(null);
    } catch {
      setErrorMessage("クリップボードへのコピーに失敗しました");
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
          ? "要約"
          : selectedOutput.action === "structure"
            ? "構造化"
            : selectedOutput.action === "extract_action_items"
              ? "タスク抽出"
              : "AI結果";
      const noteTitle = `${note.title.trim() || "無題"} - ${titleSuffix}`;

      await onCreateNoteFromOutput(noteTitle, selectedOutput.contentMd);
      setSuccessMessage("新しいメモとして保存しました。");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? formatAiErrorMessage(error.message)
          : "新しいメモとしての保存に失敗しました",
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
        <div className="modal-header ai-assistant-header">
          <div className="ai-assistant-title-block">
            <p id="ai-assistant-title" className="eyebrow">
              AIアシスタント
            </p>
            <div className="ai-model-pill" title={`${activeProviderLabel} / ${activeModelLabel}`}>
              <span>使用モデル</span>
              <strong>{activeModelLabel}</strong>
            </div>
          </div>
          <button type="button" className="ghost-button modal-close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="ai-assistant-layout">
          <section className="ai-assistant-sidebar">
            <div className="modal-section">
              <div className="section-heading">
                <h3>実行内容</h3>
              </div>
              <div className="ai-action-tabs" role="tablist" aria-label="AIアクション切り替え">
                {ACTION_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedAction === option.id}
                    className={`ai-action-tab${
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

              {selectedAction === "quick_prompt" ? (
                <label className="field">
                  <span>指示</span>
                  <textarea
                    className="ai-prompt-textarea"
                    value={quickPrompt}
                    onChange={(event) => setQuickPrompt(event.target.value)}
                    placeholder="要約、分類、書き換えなど、AIへの指示を入力してください。"
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
                {isRunning ? "実行中..." : "実行"}
              </button>
            </div>

            <div className="modal-section ai-history-section">
              <div className="section-heading">
                <h3>履歴</h3>
              </div>
              <label className="field">
                <span>絞り込み</span>
                <select
                  value={historyFilter}
                  onChange={(event) =>
                    setHistoryFilter(event.target.value as AiActionType | "all")
                  }
                >
                  <option value="all">すべて</option>
                  {ACTION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ai-history-list">
                {isLoadingHistory ? (
                  <div className="list-empty">AI履歴を読み込み中...</div>
                ) : filteredHistory.length === 0 ? (
                  <div className="list-empty">この条件の AI 出力はありません</div>
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
                <p className="eyebrow">結果</p>
                <h3>{selectedOutput ? getOutputTitle(selectedOutput.action) : "まだ結果はありません"}</h3>
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
                    候補確認
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => selectedOutput && onApplyToNote(selectedOutput.contentMd)}
                  disabled={!selectedOutput}
                >
                  反映
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleSaveAsNewNote()}
                  disabled={!selectedOutput || isSavingNewNote}
                >
                  {isSavingNewNote ? "保存中..." : "別メモ保存"}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleCopy()}
                  disabled={!selectedOutput}
                >
                  コピー
                </button>
              </div>
            </div>

            {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
            {successMessage ? <p className="success-banner">{successMessage}</p> : null}

            <div className="ai-output-card">
              {selectedOutput ? (
                <MarkdownPreview
                  markdown={selectedOutput.contentMd}
                  className="ai-output-content markdown-preview"
                />
              ) : (
                <div className="list-empty">
                  AI を実行すると、ここに結果が表示されます。
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
            setSuccessMessage(`${items.length} 件の AI タスクを保存しました。`);
          }}
          request={request}
        />
      </div>
    </div>
  );
}
