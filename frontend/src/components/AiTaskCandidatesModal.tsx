import { useEffect, useMemo, useState } from "react";

type AiTaskCandidate = {
  id: string;
  title: string;
};

type TaskItem = {
  id: string;
  title: string;
  status: "open" | "done";
  tags: string[];
  sourceNoteId: string | null;
  sourceNoteTitle: string | null;
  sourceSelectionText: string | null;
  createdBy: "manual" | "ai";
  createdAt: string;
  updatedAt: string;
};

type AiTaskCandidatesModalProps = {
  isOpen: boolean;
  noteId: string;
  noteTitle: string;
  candidates: AiTaskCandidate[];
  onClose: () => void;
  onSaved?: (items: TaskItem[]) => void;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
};

export function AiTaskCandidatesModal({
  isOpen,
  noteId,
  noteTitle,
  candidates,
  onClose,
  onSaved,
  request,
}: AiTaskCandidatesModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedIds(candidates.map((candidate) => candidate.id));
    setDrafts(
      Object.fromEntries(
        candidates.map((candidate) => [candidate.id, candidate.title]),
      ),
    );
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [candidates, isOpen]);

  const selectedCount = selectedIds.length;
  const hasCandidates = candidates.length > 0;
  const allSelected = hasCandidates && selectedCount === candidates.length;

  const selectableCandidates = useMemo(
    () =>
      candidates.map((candidate) => ({
        ...candidate,
        draftTitle: drafts[candidate.id] ?? candidate.title,
        isSelected: selectedIds.includes(candidate.id),
      })),
    [candidates, drafts, selectedIds],
  );

  if (!isOpen) {
    return null;
  }

  const toggleCandidate = (candidateId: string) => {
    setSelectedIds((currentIds) =>
      currentIds.includes(candidateId)
        ? currentIds.filter((id) => id !== candidateId)
        : [...currentIds, candidateId],
    );
  };

  const handleSave = async () => {
    const items = selectableCandidates
      .filter((candidate) => candidate.isSelected)
      .map((candidate) => candidate.draftTitle.trim())
      .filter(Boolean)
      .map((title) => ({
        title,
        status: "open" as const,
        sourceNoteId: noteId,
        sourceSelectionText: null,
        createdBy: "ai" as const,
      }));

    if (items.length === 0) {
      setErrorMessage("保存するタスクを1件以上選んでください");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await request<{ items: TaskItem[] }>("/tasks/bulk", {
        method: "POST",
        body: JSON.stringify({ items }),
      });

      setSuccessMessage(`${response.items.length} 件の AI タスクを保存しました。`);
      onSaved?.(response.items);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "AIタスクの保存に失敗しました",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card ai-task-candidates-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-task-candidates-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">AIタスク</p>
            <h2 id="ai-task-candidates-title">AI抽出タスクを確認</h2>
            <p className="modal-description">
              <strong>{noteTitle.trim() || "無題"}</strong>
              から AI が抽出したタスク候補です。保存したいものを選んでください。
            </p>
          </div>
          <button type="button" className="ghost-button modal-close" onClick={onClose}>
            閉じる
          </button>
        </div>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        {successMessage ? <p className="success-banner">{successMessage}</p> : null}

        <div className="task-candidate-toolbar">
          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              setSelectedIds(allSelected ? [] : candidates.map((candidate) => candidate.id))
            }
            disabled={!hasCandidates}
          >
            {allSelected ? "選択解除" : "すべて選択"}
          </button>
          <span className="inline-note">
            {selectedCount} / {candidates.length} 件を選択中
          </span>
        </div>

        <div className="task-candidate-list">
          {!hasCandidates ? (
            <div className="list-empty">明確なタスク候補は見つかりませんでした</div>
          ) : (
            selectableCandidates.map((candidate) => (
              <label key={candidate.id} className="task-candidate-card">
                <div className="task-candidate-row">
                  <input
                    type="checkbox"
                    checked={candidate.isSelected}
                    onChange={() => toggleCandidate(candidate.id)}
                  />
                  <input
                    className="task-candidate-input"
                    type="text"
                    value={candidate.draftTitle}
                    onChange={(event) =>
                      setDrafts((currentDrafts) => ({
                        ...currentDrafts,
                        [candidate.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              </label>
            ))
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="ghost-button" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasCandidates}
          >
            {isSaving ? "保存中..." : "選択したタスクを保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
