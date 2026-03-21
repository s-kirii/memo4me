import { useEffect, useMemo, useState } from "react";

type TaskStatus = "open" | "done";
type TaskOrigin = "manual" | "ai";

type TaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
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
  initialDraftTitle = "",
  initialSelectionText = "",
  onClose,
  onOpenNote,
  request,
}: TasksModalProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
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
        if (cancelled) {
          return;
        }

        setTasks(response.items);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "failed to load tasks",
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

    setNewTaskTitle(initialDraftTitle);
  }, [initialDraftTitle, isOpen]);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status === "open"),
    [tasks],
  );
  const doneTasks = useMemo(
    () => tasks.filter((task) => task.status === "done"),
    [tasks],
  );

  if (!isOpen) {
    return null;
  }

  const handleCreateTask = async () => {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const response = await request<{ item: TaskItem }>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: newTaskTitle,
          status: "open",
          sourceNoteId: attachCurrentNote ? currentNoteId : null,
          sourceSelectionText: initialSelectionText || null,
          createdBy: "manual",
        }),
      });

      setTasks((currentTasks) => [response.item, ...currentTasks]);
      setNewTaskTitle("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "failed to create task",
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

  const deleteTask = async (taskId: string) => {
    await request<{ ok: true }>(`/tasks/${taskId}`, {
      method: "DELETE",
    });

    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
  };

  const renderTaskList = (items: TaskItem[]) => {
    if (items.length === 0) {
      return <div className="list-empty">No tasks in this section</div>;
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
              <span className={`task-origin-pill is-${task.createdBy}`}>
                {task.createdBy === "ai" ? "AI" : "Manual"}
              </span>
              <span>{formatDateTime(task.updatedAt)}</span>
            </div>

            <div className="task-source-row">
              {task.sourceNoteId ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    onOpenNote(task.sourceNoteId as string);
                    onClose();
                  }}
                >
                  {task.sourceNoteTitle?.trim() || "Untitled note"}
                </button>
              ) : (
                <span className="inline-note">No source note</span>
              )}
              <button
                type="button"
                className="ghost-button danger-button"
                onClick={() => void deleteTask(task.id)}
              >
                Delete
              </button>
            </div>

            {task.sourceSelectionText ? (
              <p className="task-selection-preview">{task.sourceSelectionText}</p>
            ) : null}
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
        <div className="modal-header">
          <div>
            <p className="eyebrow">Tasks</p>
            <h2 id="tasks-modal-title">Task list</h2>
            <p className="modal-description">
              Track items separately from notes and jump back to the source note.
            </p>
          </div>
          <button type="button" className="ghost-button modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-section">
          <div className="task-create-row">
            <input
              className="task-create-input"
              type="text"
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              placeholder="Add a task"
            />
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleCreateTask()}
              disabled={!newTaskTitle.trim() || isCreating}
            >
              {isCreating ? "Adding..." : "Add task"}
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
              Attach current note
              {currentNoteId ? `: ${currentNoteTitle.trim() || "Untitled"}` : ""}
            </span>
          </label>
          {initialSelectionText ? (
            <p className="task-selection-preview is-draft">{initialSelectionText}</p>
          ) : null}
        </div>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

        <div className="tasks-columns">
          <section className="modal-section">
            <div className="section-heading">
              <h3>Open</h3>
              <p>{openTasks.length} items</p>
            </div>
            {isLoading ? <div className="list-empty">Loading tasks...</div> : renderTaskList(openTasks)}
          </section>

          <section className="modal-section">
            <div className="section-heading">
              <h3>Done</h3>
              <p>{doneTasks.length} items</p>
            </div>
            {isLoading ? <div className="list-empty">Loading tasks...</div> : renderTaskList(doneTasks)}
          </section>
        </div>
      </div>
    </div>
  );
}
