import { useEffect, useMemo, useState } from "react";

type TaskStatus = "open" | "done";
type TaskOrigin = "manual" | "ai";

type TaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  tags: string[];
  startTargetDate: string | null;
  dueDate: string | null;
  sourceNoteId: string | null;
  sourceNoteTitle: string | null;
  sourceSelectionText: string | null;
  createdBy: TaskOrigin;
  createdAt: string;
  updatedAt: string;
};

type TasksModalProps = {
  isOpen: boolean;
  currentNoteId: string | null;
  currentNoteTitle: string;
  currentNoteTags: string[];
  initialDraftTitle?: string;
  initialSelectionText?: string;
  onClose: () => void;
  onOpenNote: (noteId: string) => void;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
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

export function TasksModal({
  isOpen,
  currentNoteId,
  currentNoteTitle,
  currentNoteTags,
  initialDraftTitle = "",
  initialSelectionText = "",
  onClose,
  onOpenNote,
  request,
}: TasksModalProps) {
  const [activeStatusTab, setActiveStatusTab] = useState<TaskStatus>("open");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskTags, setNewTaskTags] = useState<string[]>([]);
  const [newTaskStartTargetDate, setNewTaskStartTargetDate] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [taskTagInputs, setTaskTagInputs] = useState<Record<string, string>>({});
  const [taskStartTargetDates, setTaskStartTargetDates] = useState<Record<string, string>>({});
  const [taskDueDates, setTaskDueDates] = useState<Record<string, string>>({});
  const [attachCurrentNote, setAttachCurrentNote] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    const loadTasks = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await request<{ items: TaskItem[] }>("/tasks");
        const tagResponse = await request<{ items: Array<{ id: string; name: string }> }>(
          "/tags",
        );
        if (cancelled) {
          return;
        }

        setTasks(response.items);
        setAvailableTags(tagResponse.items.map((item) => item.name));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "タスクの読み込みに失敗しました",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadTasks();

    return () => {
      cancelled = true;
    };
  }, [isOpen, request]);

  useEffect(() => {
    if (!currentNoteId) {
      setAttachCurrentNote(false);
      return;
    }

    setAttachCurrentNote(true);
  }, [currentNoteId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setActiveStatusTab("open");
    setNewTaskTitle(initialDraftTitle);
    setNewTaskTags(currentNoteId ? currentNoteTags : []);
    setNewTaskStartTargetDate("");
    setNewTaskDueDate("");
    setNewTagInput("");
    setTaskTagInputs({});
    setTaskStartTargetDates({});
    setTaskDueDates({});
  }, [currentNoteId, currentNoteTags, initialDraftTitle, isOpen]);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status === "open"),
    [tasks],
  );
  const doneTasks = useMemo(
    () => tasks.filter((task) => task.status === "done"),
    [tasks],
  );
  const visibleTasks = activeStatusTab === "open" ? openTasks : doneTasks;

  if (!isOpen) {
    return null;
  }

  const normalizeTag = (value: string) => value.trim().toLowerCase();

  const addTag = (currentTags: string[], rawTag: string) => {
    const nextTag = rawTag.trim();
    if (!nextTag) {
      return currentTags;
    }

    if (currentTags.some((tag) => normalizeTag(tag) === normalizeTag(nextTag))) {
      return currentTags;
    }

    return [...currentTags, nextTag];
  };

  const removeTag = (currentTags: string[], tagToRemove: string) =>
    currentTags.filter((tag) => tag !== tagToRemove);

  const getSuggestions = (currentTags: string[], input: string) => {
    const normalizedInput = normalizeTag(input);
    if (!normalizedInput) {
      return [];
    }

    return availableTags
      .filter(
        (tag) =>
          !currentTags.some((currentTag) => normalizeTag(currentTag) === normalizeTag(tag)),
      )
      .filter((tag) => normalizeTag(tag).includes(normalizedInput))
      .slice(0, 5);
  };

  const handleCreateTask = async () => {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const response = await request<{ item: TaskItem }>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: newTaskTitle,
          status: "open",
          tags: newTaskTags,
          startTargetDate: newTaskStartTargetDate || null,
          dueDate: newTaskDueDate || null,
          sourceNoteId: attachCurrentNote ? currentNoteId : null,
          sourceSelectionText: initialSelectionText || null,
          createdBy: "manual",
        }),
      });

      setTasks((currentTasks) => [response.item, ...currentTasks]);
      setNewTaskTitle("");
      setNewTaskTags(attachCurrentNote && currentNoteId ? currentNoteTags : []);
      setNewTaskStartTargetDate("");
      setNewTaskDueDate("");
      setNewTagInput("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "タスクの作成に失敗しました",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const updateTask = async (
    taskId: string,
    patch: {
      title?: string;
      status?: TaskStatus;
      tags?: string[];
      startTargetDate?: string | null;
      dueDate?: string | null;
    },
  ) => {
    const response = await request<{ item: TaskItem }>(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });

    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? response.item : task)),
    );
  };

  const handleUpdateTaskTags = async (taskId: string, tags: string[]) => {
    try {
      await updateTask(taskId, { tags });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "タスクタグの更新に失敗しました",
      );
    }
  };

  const renderTagEditor = (
    tags: string[],
    inputValue: string,
    onInputChange: (value: string) => void,
    onAddTag: (tag: string) => void,
    onRemoveTag: (tag: string) => void,
  ) => {
    const suggestions = getSuggestions(tags, inputValue);

    return (
      <div className="task-tags-editor">
        <div className="note-tags">
          {tags.length === 0 ? (
            <span className="tag-pill is-muted">タグなし</span>
          ) : (
            tags.map((tag) => (
              <span key={tag} className="tag-pill tag-pill-editable">
                <span>{tag}</span>
                <button
                  type="button"
                  className="tag-remove-button"
                  onClick={() => onRemoveTag(tag)}
                  aria-label={`タグ「${tag}」を削除`}
                >
                  x
                </button>
              </span>
            ))
          )}
        </div>

        <div className="task-tag-input-row">
          <input
            className="task-tag-input"
            type="text"
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAddTag(inputValue);
              }
            }}
            placeholder="タグを追加"
          />
          <button
            type="button"
            className="ghost-button tag-add-button"
            onClick={() => onAddTag(inputValue)}
          >
            タグ追加
          </button>
        </div>

        {suggestions.length > 0 ? (
          <div className="tag-suggestion-list is-inline" role="listbox">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                className="tag-suggestion-item"
                onClick={() => onAddTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const deleteTask = async (taskId: string) => {
    await request<{ ok: true }>(`/tasks/${taskId}`, {
      method: "DELETE",
    });

    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
  };

  const renderTaskList = (items: TaskItem[]) => {
    if (items.length === 0) {
      return <div className="list-empty">このセクションにタスクはありません</div>;
    }

    return (
      <div className="task-list">
        {items.map((task) => (
          <div key={task.id} className={`task-card${task.status === "done" ? " is-done" : ""}`}>
            <label className="task-card-main">
              <input
                type="checkbox"
                checked={task.status === "done"}
                onChange={(event) =>
                  void updateTask(task.id, {
                    status: event.target.checked ? "done" : "open",
                  })
                }
              />
              <input
                className="task-title-input"
                type="text"
                value={task.title}
                onChange={(event) =>
                  setTasks((currentTasks) =>
                    currentTasks.map((currentTask) =>
                      currentTask.id === task.id
                        ? { ...currentTask, title: event.target.value }
                        : currentTask,
                    ),
                  )
                }
                onBlur={(event) =>
                  void updateTask(task.id, { title: event.target.value })
                }
              />
            </label>

            <div className="task-meta-row">
              {task.createdBy === "ai" ? (
                <span className="task-ai-badge">AI</span>
              ) : null}
              {task.sourceNoteId ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    onOpenNote(task.sourceNoteId as string);
                    onClose();
                  }}
                >
                  {task.sourceNoteTitle?.trim() || "無題のメモ"}
                </button>
              ) : (
                <span className="inline-note">元メモなし</span>
              )}
              <span>{formatDateTime(task.updatedAt)}</span>
              <button
                type="button"
                className="ghost-button danger-button task-delete-button"
                onClick={() => void deleteTask(task.id)}
              >
                削除
              </button>
            </div>

            {task.sourceSelectionText ? (
              <p className="task-selection-preview">{task.sourceSelectionText}</p>
            ) : null}

            <div className="task-date-row">
              <label className="task-date-field">
                <span>着手目標</span>
                <input
                  type="date"
                  value={taskStartTargetDates[task.id] ?? task.startTargetDate ?? ""}
                  onChange={(event) =>
                    setTaskStartTargetDates((current) => ({
                      ...current,
                      [task.id]: event.target.value,
                    }))
                  }
                  onBlur={(event) =>
                    void updateTask(task.id, {
                      startTargetDate: event.target.value || null,
                    })
                  }
                />
              </label>
              <label className="task-date-field">
                <span>期日</span>
                <input
                  type="date"
                  value={taskDueDates[task.id] ?? task.dueDate ?? ""}
                  onChange={(event) =>
                    setTaskDueDates((current) => ({
                      ...current,
                      [task.id]: event.target.value,
                    }))
                  }
                  onBlur={(event) =>
                    void updateTask(task.id, {
                      dueDate: event.target.value || null,
                    })
                  }
                />
              </label>
            </div>

            {renderTagEditor(
              task.tags,
              taskTagInputs[task.id] ?? "",
              (value) =>
                setTaskTagInputs((current) => ({
                  ...current,
                  [task.id]: value,
                })),
              (rawTag) => {
                const nextTags = addTag(task.tags, rawTag);
                if (nextTags === task.tags) {
                  return;
                }

                setTaskTagInputs((current) => ({ ...current, [task.id]: "" }));
                void handleUpdateTaskTags(task.id, nextTags);
              },
              (tagToRemove) => {
                void handleUpdateTaskTags(task.id, removeTag(task.tags, tagToRemove));
              },
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card tasks-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tasks-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header tasks-modal-header">
          <p id="tasks-modal-title" className="eyebrow">
            タスクリスト
          </p>
          <button type="button" className="ghost-button modal-close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="modal-section">
          <div className="task-create-row">
            <input
              className="task-create-input"
              type="text"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="タスクを入力"
            />
            <button
              type="button"
              className="primary-button task-create-button"
              onClick={() => void handleCreateTask()}
              disabled={!newTaskTitle.trim() || isCreating}
            >
              {isCreating ? "追加中..." : "追加"}
            </button>
          </div>
          <label className="task-attach-toggle">
            <input
              type="checkbox"
              checked={attachCurrentNote}
              onChange={(event) => setAttachCurrentNote(event.target.checked)}
              disabled={!currentNoteId}
            />
            <span>
              現在のメモを紐付ける
              {currentNoteId ? `: ${currentNoteTitle.trim() || "無題"}` : ""}
            </span>
          </label>
          {initialSelectionText ? (
            <p className="task-selection-preview is-draft">{initialSelectionText}</p>
          ) : null}

          <div className="task-create-details">
            <label className="task-date-field">
              <span>着手目標</span>
              <input
                type="date"
                value={newTaskStartTargetDate}
                onChange={(event) => setNewTaskStartTargetDate(event.target.value)}
              />
            </label>
            <label className="task-date-field">
              <span>期日</span>
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(event) => setNewTaskDueDate(event.target.value)}
              />
            </label>
          </div>

          {renderTagEditor(
            newTaskTags,
            newTagInput,
            setNewTagInput,
            (rawTag) => {
              setNewTaskTags((currentTags) => addTag(currentTags, rawTag));
              setNewTagInput("");
            },
            (tagToRemove) => {
              setNewTaskTags((currentTags) => removeTag(currentTags, tagToRemove));
            },
          )}
        </div>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

        <section className="modal-section">
          <div className="task-status-tabs" role="tablist" aria-label="タスクの表示切り替え">
            <button
              type="button"
              role="tab"
              aria-selected={activeStatusTab === "open"}
              className={`task-status-tab${activeStatusTab === "open" ? " is-active" : ""}`}
              onClick={() => setActiveStatusTab("open")}
            >
              <span>未完了</span>
              <small>{openTasks.length} 件</small>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeStatusTab === "done"}
              className={`task-status-tab${activeStatusTab === "done" ? " is-active" : ""}`}
              onClick={() => setActiveStatusTab("done")}
            >
              <span>完了</span>
              <small>{doneTasks.length} 件</small>
            </button>
          </div>

          {isLoading ? (
            <div className="list-empty">タスクを読み込み中...</div>
          ) : (
            renderTaskList(visibleTasks)
          )}
        </section>
      </div>
    </div>
  );
}
