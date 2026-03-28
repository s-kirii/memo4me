import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as holidayJp from "@holiday-jp/holiday_jp";

type TaskStatus = "open" | "in_progress" | "done";
type TaskOrigin = "manual" | "ai";
type TaskSortKey = "updated_desc" | "due_asc" | "title_asc";

type TaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  isTodayTask: boolean;
  estimatedHours: number | null;
  progressPercent: number;
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

type NoteOption = {
  id: string;
  title: string;
};

type TodayTaskFilter = "__all__" | "__today__";
type ForecastMode = "weekly" | "monthly";
type ForecastDayLevel = "safe" | "watch" | "risk";
type SprintCalendarMode = "calendar_days" | "working_days";

type ForecastContribution = {
  taskId: string;
  title: string;
  requiredHours: number;
  dueDate: string | null;
  sourceNoteTitle: string | null;
  progressPercent: number;
};

type ForecastDay = {
  key: string;
  label: string;
  shortLabel: string;
  weekdayLabel: string;
  totalHours: number;
  level: ForecastDayLevel;
  contributions: ForecastContribution[];
};

type TaskWorkspaceProps = {
  isActive: boolean;
  reloadRequestKey?: number;
  sprintCalendarMode: SprintCalendarMode;
  currentNoteId: string | null;
  currentNoteTitle: string;
  currentNoteTags: string[];
  initialDraftTitle?: string;
  initialSelectionText?: string;
  createRequestKey: number;
  onConsumePrefill: () => void;
  navigationRequestKey: number;
  targetTaskId?: string | null;
  targetNoteId?: string | null;
  onConsumeNavigation: () => void;
  onOpenNote: (noteId: string) => void;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
};

type FireForecastLevel = "safe" | "watch" | "risk";

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

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

function formatDateLabel(value: string | null) {
  if (!value) {
    return "期日なし";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getDueState(value: string | null, status?: TaskStatus) {
  if (status === "done") {
    return "none" as const;
  }

  if (!value) {
    return "none" as const;
  }

  const dueDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) {
    return "none" as const;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dueDate.getTime() < today.getTime()) {
    return "overdue" as const;
  }

  if (dueDate.getTime() === today.getTime()) {
    return "today" as const;
  }

    return "upcoming" as const;
}

function getForecastLabel(level: FireForecastLevel) {
  if (level === "risk") {
    return "危険";
  }
  if (level === "watch") {
    return "注意";
  }
  return "安全";
}

function getStatusLabel(status: TaskStatus) {
  if (status === "done") {
    return "完了";
  }

  if (status === "in_progress") {
    return "進行中";
  }

  return "未着手";
}

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function getRemainingHours(task: TaskItem) {
  if (task.estimatedHours === null || task.estimatedHours <= 0) {
    return null;
  }

  return Math.max(0, (task.estimatedHours * (100 - task.progressPercent)) / 100);
}

function getForecastDayLevel(totalHours: number): ForecastDayLevel {
  if (totalHours > 8) {
    return "risk";
  }

  if (totalHours > 5) {
    return "watch";
  }

  return "safe";
}

function formatForecastHours(value: number) {
  return `${value.toFixed(1)}h`;
}

function normalizeProgressPercent(value: number) {
  if (Number.isNaN(value)) {
    return 0;
  }

  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped / 5) * 5;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isSameOrAfter(left: Date, right: Date) {
  return left.getTime() >= right.getTime();
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isJapaneseHoliday(date: Date) {
  return holidayJp.isHoliday(date);
}

function isWorkingDay(date: Date) {
  return !isWeekend(date) && !isJapaneseHoliday(date);
}

function countDaysInclusive(
  startDate: Date,
  endDate: Date,
  mode: SprintCalendarMode,
) {
  if (endDate.getTime() < startDate.getTime()) {
    return 0;
  }

  if (mode === "calendar_days") {
    return (
      Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
  }

  let count = 0;
  for (
    let cursor = new Date(startDate);
    cursor.getTime() <= endDate.getTime();
    cursor = addDays(cursor, 1)
  ) {
    if (isWorkingDay(cursor)) {
      count += 1;
    }
  }

  return count;
}

function isEffectiveTodayTask(task: TaskItem, referenceDate = startOfToday()) {
  const startDate = parseDateOnly(task.startTargetDate);
  if (!startDate) {
    return false;
  }

  return isSameOrAfter(referenceDate, startDate);
}

function isActiveTodayTask(task: TaskItem, referenceDate = startOfToday()) {
  if (task.status === "done") {
    return false;
  }

  return isEffectiveTodayTask(task, referenceDate);
}

function calculateTodayTargetSnapshot(
  task: TaskItem,
  referenceDate: Date,
  calendarMode: SprintCalendarMode,
) {
  const startDate = parseDateOnly(task.startTargetDate);
  const dueDate = parseDateOnly(task.dueDate);

  if (!startDate || !dueDate) {
    return null;
  }

  const totalUnits = countDaysInclusive(startDate, dueDate, calendarMode);
  if (totalUnits <= 0) {
    return null;
  }

  const previousDay = addDays(referenceDate, -1);
  const elapsedUnitsToday = countDaysInclusive(startDate, referenceDate, calendarMode);
  const elapsedUnitsPrevious = countDaysInclusive(startDate, previousDay, calendarMode);
  const targetToday = Math.max(0, Math.min(100, (100 / totalUnits) * elapsedUnitsToday));
  const targetPrevious = Math.max(0, Math.min(100, (100 / totalUnits) * elapsedUnitsPrevious));
  const remainingPercentToTarget = Math.round((targetToday - task.progressPercent) * 10) / 10;
  const remainingHoursToTarget =
    task.estimatedHours === null || task.estimatedHours <= 0
      ? null
      : Math.round(((task.estimatedHours * remainingPercentToTarget) / 100) * 10) / 10;

  return {
    targetToday,
    targetPrevious,
    remainingPercentToTarget,
    remainingHoursToTarget,
  };
}

export function TaskWorkspace({
  isActive,
  reloadRequestKey = 0,
  sprintCalendarMode,
  currentNoteId,
  currentNoteTags,
  initialDraftTitle = "",
  initialSelectionText = "",
  createRequestKey,
  onConsumePrefill,
  navigationRequestKey,
  targetTaskId = null,
  targetNoteId = null,
  onConsumeNavigation,
  onOpenNote,
  request,
}: TaskWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const handledCreateRequestKeyRef = useRef(0);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [notes, setNotes] = useState<NoteOption[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState("__all__");
  const [activeSourceNoteFilter, setActiveSourceNoteFilter] = useState("__all__");
  const [activeTodayTaskFilter, setActiveTodayTaskFilter] =
    useState<TodayTaskFilter>("__all__");
  const [taskSortKey, setTaskSortKey] = useState<TaskSortKey>("updated_desc");
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [isTodayBreakdownOpen, setIsTodayBreakdownOpen] = useState(false);
  const [forecastMode, setForecastMode] = useState<ForecastMode>("weekly");
  const [activeForecastDay, setActiveForecastDay] = useState<ForecastDay | null>(null);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [attachCurrentNote, setAttachCurrentNote] = useState(false);
  const [newTaskSourceNoteId, setNewTaskSourceNoteId] = useState("");
  const [newTaskTags, setNewTaskTags] = useState<string[]>([]);
  const [newTaskEstimatedHours, setNewTaskEstimatedHours] = useState("");
  const [newTaskProgressPercent, setNewTaskProgressPercent] = useState(0);
  const [newTaskStartTargetDate, setNewTaskStartTargetDate] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTagInput, setNewTagInput] = useState("");

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskTagInputs, setTaskTagInputs] = useState<Record<string, string>>({});
  const [taskDraftTags, setTaskDraftTags] = useState<Record<string, string[]>>({});
  const [taskSourceNoteIds, setTaskSourceNoteIds] = useState<Record<string, string>>({});
  const [taskEstimatedHours, setTaskEstimatedHours] = useState<Record<string, string>>({});
  const [taskProgressPercents, setTaskProgressPercents] = useState<Record<string, number>>({});
  const [taskStartTargetDates, setTaskStartTargetDates] = useState<Record<string, string>>({});
  const [taskDueDates, setTaskDueDates] = useState<Record<string, string>>({});
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});

  const loadWorkspaceData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [taskResponse, noteResponse, tagResponse] = await Promise.all([
        request<{ items: TaskItem[] }>("/tasks"),
        request<{ items: NoteOption[] }>("/notes"),
        request<{ items: Array<{ id: string; name: string }> }>("/tags"),
      ]);

      setTasks(taskResponse.items);
      setNotes(noteResponse.items);
      setAvailableTags(tagResponse.items.map((item) => item.name));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "タスクの読み込みに失敗しました",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspaceData();
  }, []);

  useEffect(() => {
    if (reloadRequestKey === 0) {
      return;
    }

    void loadWorkspaceData();
  }, [reloadRequestKey]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (initialDraftTitle.trim() || initialSelectionText.trim()) {
      setNewTaskTitle(initialDraftTitle);
      setAttachCurrentNote(Boolean(currentNoteId));
      setNewTaskSourceNoteId(currentNoteId ?? "");
      setNewTaskTags(currentNoteId ? currentNoteTags : []);
      setIsCreateModalOpen(true);
      onConsumePrefill();
    }
  }, [
    currentNoteId,
    currentNoteTags,
    initialDraftTitle,
    initialSelectionText,
    isActive,
    onConsumePrefill,
  ]);

  useEffect(() => {
    if (!isActive || createRequestKey === 0) {
      return;
    }

    if (createRequestKey === handledCreateRequestKeyRef.current) {
      return;
    }

    handledCreateRequestKeyRef.current = createRequestKey;
    setIsCreateModalOpen(true);
  }, [createRequestKey, isActive]);

  useEffect(() => {
    if (!isActive || !isCreateModalOpen) {
      return;
    }

    createInputRef.current?.focus();
    createInputRef.current?.select();
  }, [isActive, isCreateModalOpen]);

  useEffect(() => {
    if (!isActive || navigationRequestKey === 0) {
      return;
    }

    const targetTask = targetTaskId
      ? tasks.find((task) => task.id === targetTaskId) ?? null
      : null;

    setSearchQuery("");
    setActiveTagFilter("__all__");
    setActiveTodayTaskFilter("__all__");

    if (targetNoteId) {
      setActiveSourceNoteFilter(targetNoteId);
    }

    if (targetTaskId) {
      setExpandedTaskId(targetTaskId);
    }

    if (targetTask?.status === "done") {
      setIsCompletedModalOpen(true);
    }

    onConsumeNavigation();
  }, [
    isActive,
    navigationRequestKey,
    onConsumeNavigation,
    targetNoteId,
    targetTaskId,
    tasks,
  ]);

  useEffect(() => {
    if (!expandedTaskId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const workspace = workspaceRef.current;
      const target = event.target as HTMLElement | null;
      if (!workspace || !target || !workspace.contains(target)) {
        setExpandedTaskId(null);
        return;
      }

      if (target.closest(".task-board-row.is-expanded")) {
        return;
      }

      setExpandedTaskId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [expandedTaskId]);

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

  const initializeTaskDraft = (task: TaskItem) => {
    setTaskSourceNoteIds((current) => ({
      ...current,
      [task.id]: task.sourceNoteId ?? "",
    }));
    setTaskDraftTags((current) => ({
      ...current,
      [task.id]: task.tags,
    }));
    setTaskTagInputs((current) => ({
      ...current,
      [task.id]: current[task.id] ?? "",
    }));
    setTaskEstimatedHours((current) => ({
      ...current,
      [task.id]: task.estimatedHours?.toString() ?? "",
    }));
    setTaskProgressPercents((current) => ({
      ...current,
      [task.id]: task.progressPercent,
    }));
    setTaskStartTargetDates((current) => ({
      ...current,
      [task.id]: task.startTargetDate ?? "",
    }));
    setTaskDueDates((current) => ({
      ...current,
      [task.id]: task.dueDate ?? "",
    }));
    setTaskNotes((current) => ({
      ...current,
      [task.id]: task.noteText ?? "",
    }));
  };

  const resetTaskDraft = (task: TaskItem) => {
    initializeTaskDraft(task);
  };

  const areTagsEqual = (left: string[], right: string[]) =>
    left.length === right.length && left.every((tag, index) => tag === right[index]);

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

  const updateTask = async (
    taskId: string,
    patch: {
      title?: string;
      status?: TaskStatus;
      isTodayTask?: boolean;
      estimatedHours?: number | null;
      progressPercent?: number;
      tags?: string[];
      startTargetDate?: string | null;
      dueDate?: string | null;
      noteText?: string | null;
      sourceNoteId?: string | null;
    },
  ) => {
    const response = await request<{ item: TaskItem }>(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });

    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? response.item : task)),
    );
    return response.item;
  };

  const handleCreateTask = async () => {
    setIsCreating(true);
    setErrorMessage(null);

    try {
      const response = await request<{ item: TaskItem }>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: newTaskTitle,
          progressPercent: newTaskProgressPercent,
          estimatedHours:
            newTaskEstimatedHours.trim() === ""
              ? null
              : Number(newTaskEstimatedHours),
          tags: newTaskTags,
          startTargetDate: newTaskStartTargetDate || null,
          dueDate: newTaskDueDate || null,
          sourceNoteId: attachCurrentNote ? newTaskSourceNoteId || null : null,
          sourceSelectionText: initialSelectionText || null,
          createdBy: "manual",
        }),
      });

      setTasks((currentTasks) => [response.item, ...currentTasks]);
      setNewTaskTitle("");
      setAttachCurrentNote(false);
      setNewTaskSourceNoteId("");
      setNewTaskTags([]);
      setNewTaskEstimatedHours("");
      setNewTaskProgressPercent(0);
      setNewTaskStartTargetDate("");
      setNewTaskDueDate("");
      setNewTagInput("");
      setIsCreateModalOpen(false);
      await loadWorkspaceData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "タスクの作成に失敗しました",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    await request<{ ok: true }>(`/tasks/${taskId}`, {
      method: "DELETE",
    });

    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
    setExpandedTaskId((currentTaskId) => (currentTaskId === taskId ? null : currentTaskId));
    await loadWorkspaceData();
  };

  const saveTaskDetails = async (task: TaskItem) => {
    const nextProgress = taskProgressPercents[task.id] ?? task.progressPercent;
    const nextEstimatedHoursRaw =
      taskEstimatedHours[task.id] ?? (task.estimatedHours?.toString() ?? "");
    const nextEstimatedHours =
      nextEstimatedHoursRaw.trim() === "" ? null : Number(nextEstimatedHoursRaw);
    const nextStartTargetDate = taskStartTargetDates[task.id] ?? task.startTargetDate ?? "";
    const nextDueDate = taskDueDates[task.id] ?? task.dueDate ?? "";
    const nextNoteText = taskNotes[task.id] ?? task.noteText ?? "";
    const nextSourceNoteId = taskSourceNoteIds[task.id] ?? task.sourceNoteId ?? "";
    const nextTags = taskDraftTags[task.id] ?? task.tags;

    const updatedTask = await updateTask(task.id, {
      progressPercent: nextProgress,
      estimatedHours: nextEstimatedHours,
      startTargetDate: nextStartTargetDate || null,
      dueDate: nextDueDate || null,
      noteText: nextNoteText || null,
      sourceNoteId: nextSourceNoteId || null,
      tags: nextTags,
    });

    resetTaskDraft(updatedTask);
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

  const renderProgressStepper = (
    value: number,
    onChange: (nextValue: number) => void,
    ariaLabel: string,
  ) => (
    <input
      type="number"
      className="task-progress-stepper"
      min="0"
      max="100"
      step="5"
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => {
        const nextValue = normalizeProgressPercent(Number(event.target.value));
        onChange(nextValue);
      }}
    />
  );

  const filteredTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const today = startOfToday();

    const nextTasks = tasks.filter((task) => {
      const activeTodayTask = isActiveTodayTask(task, today);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        task.title.toLowerCase().includes(normalizedQuery) ||
        (task.noteText ?? "").toLowerCase().includes(normalizedQuery) ||
        (task.sourceNoteTitle ?? "").toLowerCase().includes(normalizedQuery) ||
        task.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      const matchesTag =
        activeTagFilter === "__all__" ||
        task.tags.some((tag) => normalizeTag(tag) === normalizeTag(activeTagFilter));

      const matchesSourceNote =
        activeSourceNoteFilter === "__all__" || task.sourceNoteId === activeSourceNoteFilter;

      const matchesTodayTask =
        activeTodayTaskFilter === "__all__" || activeTodayTask;

      return matchesQuery && matchesTag && matchesSourceNote && matchesTodayTask;
    });

    nextTasks.sort((left, right) => {
      if (taskSortKey === "due_asc") {
        const leftDue = left.dueDate
          ? new Date(`${left.dueDate}T00:00:00`).getTime()
          : Number.MAX_SAFE_INTEGER;
        const rightDue = right.dueDate
          ? new Date(`${right.dueDate}T00:00:00`).getTime()
          : Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }

      if (taskSortKey === "title_asc") {
        return left.title.localeCompare(right.title, "ja");
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });

    return nextTasks;
  }, [
    activeSourceNoteFilter,
    activeTagFilter,
    activeTodayTaskFilter,
    searchQuery,
    taskSortKey,
    tasks,
  ]);

  const groupedTasks = useMemo(
    () => ({
      open: filteredTasks.filter((task) => task.status === "open"),
      in_progress: filteredTasks.filter((task) => task.status === "in_progress"),
      done: filteredTasks.filter((task) => task.status === "done"),
    }),
    [filteredTasks],
  );

  const todaySprintSummary = useMemo(() => {
    const today = startOfToday();
    const previousDay = addDays(today, -1);
    const todayTasks = filteredTasks.filter((task) => isEffectiveTodayTask(task, today));

    let eligibleCount = 0;
    let preStartCount = 0;
    let unestimatedCount = 0;
    let unscheduledCount = 0;

    let hoursNumerator = 0;
    let hoursDenominator = 0;
    for (const task of todayTasks) {
      const startDate = parseDateOnly(task.startTargetDate);
      const dueDate = parseDateOnly(task.dueDate);

      if (!startDate || !dueDate) {
        unscheduledCount += 1;
        continue;
      }

      if (!isSameOrAfter(today, startDate)) {
        preStartCount += 1;
        continue;
      }

      const totalUnits = countDaysInclusive(startDate, dueDate, sprintCalendarMode);
      if (totalUnits <= 0) {
        unscheduledCount += 1;
        continue;
      }

      const elapsedUnitsToday = countDaysInclusive(startDate, today, sprintCalendarMode);
      const elapsedUnitsPrevious = countDaysInclusive(startDate, previousDay, sprintCalendarMode);
      const targetToday = (100 / totalUnits) * elapsedUnitsToday;
      const targetPrevious = (100 / totalUnits) * elapsedUnitsPrevious;
      const dailyTarget = targetToday - targetPrevious;

      if (dailyTarget <= 0) {
        continue;
      }

      eligibleCount += 1;

      if (task.estimatedHours === null || task.estimatedHours <= 0) {
        unestimatedCount += 1;
        continue;
      }

      hoursNumerator += task.estimatedHours * (task.progressPercent - targetPrevious);
      hoursDenominator += task.estimatedHours * dailyTarget;
    }

    const sprintRatio = hoursDenominator === 0 ? null : hoursNumerator / hoursDenominator;
    const activePercent = sprintRatio === null ? null : Math.round(sprintRatio * 100);
    const ringPercent =
      activePercent === null ? 0 : Math.max(0, Math.min(100, activePercent));
    const todayIsWorkingDay = isWorkingDay(today);
    const calendarModeLabel =
      sprintCalendarMode === "working_days" ? "稼働日ベース" : "全日ベース";
    const summaryStatus =
      activePercent === null
        ? "対象なし"
        : activePercent >= 100
          ? "順調"
          : activePercent >= 0
            ? "未達"
            : "遅れ";

    return {
      todayTaskCount: todayTasks.length,
      eligibleCount,
      preStartCount,
      unscheduledCount,
      unestimatedCount,
      sprintRatio,
      activePercent,
      ringPercent,
      todayIsWorkingDay,
      calendarModeLabel,
      summaryStatus,
      summaryBody:
        activePercent === null
          ? sprintCalendarMode === "working_days" && !todayIsWorkingDay
            ? "今日は非稼働日です"
            : "今日ぶんの目標があるタスクはありません"
          : activePercent >= 100
            ? "今日ぶんの目標は満たせています"
            : activePercent >= 0
              ? "今日ぶんの目標に対してまだ不足があります"
              : "昨日までの未達を持ち越しています",
    };
  }, [filteredTasks, sprintCalendarMode]);

  const todayBreakdownItems = useMemo(() => {
    const today = startOfToday();
    const previousDay = addDays(today, -1);

    return filteredTasks
      .filter((task) => {
        if (!isEffectiveTodayTask(task, today)) {
          return false;
        }

        if (task.status === "done") {
          const dueDate = parseDateOnly(task.dueDate);
          if (dueDate && dueDate.getTime() < today.getTime()) {
            return false;
          }
        }

        return true;
      })
      .map((task) => {
        const startDate = parseDateOnly(task.startTargetDate);
        const dueDate = parseDateOnly(task.dueDate);
        const totalUnits =
          startDate && dueDate ? countDaysInclusive(startDate, dueDate, sprintCalendarMode) : 0;
        const elapsedUnitsToday =
          startDate && dueDate ? countDaysInclusive(startDate, today, sprintCalendarMode) : 0;
        const elapsedUnitsPrevious =
          startDate && dueDate ? countDaysInclusive(startDate, previousDay, sprintCalendarMode) : 0;
        const targetToday =
          totalUnits > 0 ? Math.max(0, Math.min(100, (100 / totalUnits) * elapsedUnitsToday)) : null;
        const targetPrevious =
          totalUnits > 0
            ? Math.max(0, Math.min(100, (100 / totalUnits) * elapsedUnitsPrevious))
            : null;
        const remainingPercentToTarget =
          targetToday === null ? null : Math.round((targetToday - task.progressPercent) * 10) / 10;
        const remainingHoursToTarget =
          remainingPercentToTarget === null || task.estimatedHours === null || task.estimatedHours <= 0
            ? null
            : Math.round((task.estimatedHours * remainingPercentToTarget) / 100 * 10) / 10;

        return {
          id: task.id,
          title: task.title,
          dueDate: task.dueDate,
          dueLabel: formatDateLabel(task.dueDate),
          targetToday,
          targetPrevious,
          currentProgress: task.progressPercent,
          remainingHoursToTarget,
        };
      })
      .sort((left, right) => {
        const leftDue = left.dueDate
          ? new Date(`${left.dueDate}T00:00:00`).getTime()
          : Number.MAX_SAFE_INTEGER;
        const rightDue = right.dueDate
          ? new Date(`${right.dueDate}T00:00:00`).getTime()
          : Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }
        return left.title.localeCompare(right.title, "ja");
      });
  }, [filteredTasks, sprintCalendarMode]);

  const forecast = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayCount = forecastMode === "weekly" ? 7 : 30;
    const days = Array.from({ length: dayCount }, (_, index) => {
      const date = addDays(today, index);
      const key = toDateKey(date);
      return {
        key,
        label: new Intl.DateTimeFormat("ja-JP", {
          month: "2-digit",
          day: "2-digit",
          weekday: forecastMode === "weekly" ? "short" : undefined,
        }).format(date),
        shortLabel: new Intl.DateTimeFormat("ja-JP", {
          month: "2-digit",
          day: "2-digit",
        }).format(date),
        weekdayLabel: new Intl.DateTimeFormat("ja-JP", {
          weekday: "short",
        }).format(date),
        totalHours: 0,
        level: "safe" as ForecastDayLevel,
        contributions: [] as ForecastContribution[],
      };
    });

    const daysByKey = new Map(days.map((day) => [day.key, day]));
    let unestimatedCount = 0;
    let unscheduledCount = 0;
    let forecastableTaskCount = 0;

    for (const task of filteredTasks) {
      if (task.status === "done") {
        continue;
      }

      const remainingHours = getRemainingHours(task);
      if (remainingHours === null) {
        unestimatedCount += 1;
        continue;
      }

      if (remainingHours <= 0) {
        continue;
      }

      const dueDate = parseDateOnly(task.dueDate);
      if (!dueDate) {
        unscheduledCount += 1;
        continue;
      }

      forecastableTaskCount += 1;

      const startTargetDate = parseDateOnly(task.startTargetDate);
      const effectiveStart =
        startTargetDate && startTargetDate.getTime() > today.getTime() ? startTargetDate : today;
      const effectiveEnd = dueDate.getTime() < today.getTime() ? today : dueDate;
      const rangeStart =
        effectiveEnd.getTime() < effectiveStart.getTime() ? effectiveEnd : effectiveStart;
      const rangeEnd = effectiveEnd;
      const remainingDays =
        Math.max(
          1,
          Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        );
      const requiredHoursPerDay = remainingHours / remainingDays;

      for (let index = 0; index < remainingDays; index += 1) {
        const targetDate = addDays(rangeStart, index);
        const targetDay = daysByKey.get(toDateKey(targetDate));
        if (!targetDay) {
          continue;
        }

        targetDay.totalHours += requiredHoursPerDay;
        targetDay.contributions.push({
          taskId: task.id,
          title: task.title,
          requiredHours: requiredHoursPerDay,
          dueDate: task.dueDate,
          sourceNoteTitle: task.sourceNoteTitle,
          progressPercent: task.progressPercent,
        });
      }
    }

    for (const day of days) {
      day.totalHours = Math.round(day.totalHours * 10) / 10;
      day.level = getForecastDayLevel(day.totalHours);
      day.contributions.sort((left, right) => right.requiredHours - left.requiredHours);
    }

    const highestRiskDay = [...days].sort((left, right) => {
      const levelScore = { safe: 0, watch: 1, risk: 2 } as const;
      if (levelScore[right.level] !== levelScore[left.level]) {
        return levelScore[right.level] - levelScore[left.level];
      }

      return right.totalHours - left.totalHours;
    })[0];

    return {
      mode: forecastMode,
      days,
      unestimatedCount,
      unscheduledCount,
      forecastableTaskCount,
      highestRiskDay,
    };
  }, [filteredTasks, forecastMode]);

  const activeSourceNoteTitle = useMemo(() => {
    if (activeSourceNoteFilter === "__all__") {
      return null;
    }

    return notes.find((note) => note.id === activeSourceNoteFilter)?.title.trim() || "無題";
  }, [activeSourceNoteFilter, notes]);

  const renderTaskRow = (task: TaskItem) => {
    const dueState = getDueState(task.dueDate, task.status);
    const isExpanded = expandedTaskId === task.id;
    const referenceDate = startOfToday();
    const activeTodayTask = isActiveTodayTask(task, referenceDate);
    const targetSnapshot = calculateTodayTargetSnapshot(
      task,
      referenceDate,
      sprintCalendarMode,
    );
    const draftSourceNoteId = taskSourceNoteIds[task.id] ?? task.sourceNoteId ?? "";
    const draftTags = taskDraftTags[task.id] ?? task.tags;
    const draftEstimatedHours = taskEstimatedHours[task.id] ?? (task.estimatedHours?.toString() ?? "");
    const draftProgressPercent = taskProgressPercents[task.id] ?? task.progressPercent;
    const draftStartTargetDate = taskStartTargetDates[task.id] ?? task.startTargetDate ?? "";
    const draftDueDate = taskDueDates[task.id] ?? task.dueDate ?? "";
    const draftNoteText = taskNotes[task.id] ?? task.noteText ?? "";
    const isTaskDirty =
      draftSourceNoteId !== (task.sourceNoteId ?? "") ||
      !areTagsEqual(draftTags, task.tags) ||
      draftEstimatedHours !== (task.estimatedHours?.toString() ?? "") ||
      draftProgressPercent !== task.progressPercent ||
      draftStartTargetDate !== (task.startTargetDate ?? "") ||
      draftDueDate !== (task.dueDate ?? "") ||
      draftNoteText !== (task.noteText ?? "");

    return (
      <article
        key={task.id}
        className={`task-board-row${isExpanded ? " is-expanded" : ""}${task.status === "done" ? " is-done" : ""}${dueState === "today" ? " is-due-today" : ""}${dueState === "overdue" ? " is-overdue" : ""}`}
      >
        <div className="task-board-row-summary">
          <label className="task-board-row-main">
            <input
              type="checkbox"
              checked={activeTodayTask}
              disabled
              title={
                task.status === "done"
                  ? "完了タスクは今日やる対象外です"
                  : activeTodayTask
                    ? "着手日以降のため自動で今日やるに含まれています"
                    : "着手日までは今日やるに含まれません"
              }
              aria-label={
                activeTodayTask
                  ? "着手日以降のため今日やるに含まれています"
                  : "まだ今日やる対象ではありません"
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
              onBlur={(event) => void updateTask(task.id, { title: event.target.value })}
            />
          </label>

          <div className="task-board-row-meta-inline">
            <span className={`task-row-due is-${dueState}`}>{formatDateLabel(task.dueDate)}</span>
            <span className={`task-row-status task-row-meta-item priority-1 is-${task.status}`}>
              {getStatusLabel(task.status)}
            </span>
            <span className="task-row-target task-row-meta-item priority-2">
              目標 {targetSnapshot === null ? "--" : `${Math.round(targetSnapshot.targetToday)}%`}
            </span>
            <span className="task-row-progress task-row-meta-item priority-0">
              {task.progressPercent}%
            </span>
            {activeTodayTask ? (
              <span className="task-row-today task-row-meta-item priority-3">今日やる</span>
            ) : null}
            <div className="task-row-tags task-row-meta-item priority-4">
              {task.tags.length === 0 ? (
                <span className="task-row-tag is-empty">タグなし</span>
              ) : (
                task.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="task-row-tag">
                    {tag}
                  </span>
                ))
              )}
              {task.tags.length > 3 ? (
                <span className="task-row-tag is-empty">+{task.tags.length - 3}</span>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="ghost-button task-complete-button"
            onClick={() => {
              setTaskProgressPercents((current) => ({
                ...current,
                [task.id]: 100,
              }));
              void updateTask(task.id, {
                progressPercent: 100,
              });
            }}
            disabled={task.status === "done"}
          >
            完了
          </button>

          <button
            type="button"
            className="ghost-button task-expand-button"
            aria-label={isExpanded ? "詳細を閉じる" : "詳細を表示"}
            title={isExpanded ? "詳細を閉じる" : "詳細を表示"}
            onClick={() =>
              setExpandedTaskId((current) => {
                const nextExpandedId = current === task.id ? null : task.id;
                if (nextExpandedId === task.id) {
                  initializeTaskDraft(task);
                }
                return nextExpandedId;
              })
            }
          >
            {isExpanded ? "▴" : "▾"}
          </button>
        </div>

        {isExpanded ? (
          <div className="task-board-row-detail">
            <div className="task-detail-meta-row">
              <div className="task-meta-primary">
                {task.createdBy === "ai" ? <span className="task-ai-badge">AI</span> : null}
                <select
                  className="task-note-select"
                  value={draftSourceNoteId}
                  onChange={(event) =>
                    setTaskSourceNoteIds((current) => ({
                      ...current,
                      [task.id]: event.target.value,
                    }))
                  }
                  aria-label="紐付けメモ"
                >
                  <option value="">元メモなし</option>
                  {notes.map((note) => (
                    <option key={note.id} value={note.id}>
                      {note.title.trim() || "無題のメモ"}
                    </option>
                  ))}
                </select>
                {draftSourceNoteId ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onOpenNote(draftSourceNoteId)}
                  >
                    開く
                  </button>
                ) : null}
                <span>{formatDateTime(task.updatedAt)}</span>
                <span className={`task-detail-status-pill is-${task.status}`}>
                  {getStatusLabel(task.status)}
                </span>
              </div>

              <button
                type="button"
                className="ghost-button danger-button task-delete-button"
                onClick={() => void deleteTask(task.id)}
              >
                削除
              </button>
            </div>

            <div className="task-detail-progress-row">
              <div className="task-inline-field task-inline-field-progress">
                <span>進捗率</span>
                {renderProgressStepper(
                  draftProgressPercent,
                  (nextValue) => {
                    setTaskProgressPercents((current) => ({
                      ...current,
                      [task.id]: nextValue,
                    }));
                  },
                  `タスク「${task.title}」の進捗率`,
                )}
              </div>
              <label className="task-inline-field">
                <span>想定工数[H]</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={draftEstimatedHours}
                  onChange={(event) =>
                    setTaskEstimatedHours((current) => ({
                      ...current,
                      [task.id]: event.target.value,
                    }))
                  }
                  placeholder="未設定"
                />
              </label>
            </div>

            <div className="task-detail-schedule-row">
              <label className="task-inline-field">
                <span>着手目標</span>
                <input
                  type="date"
                  value={draftStartTargetDate}
                  onChange={(event) =>
                    setTaskStartTargetDates((current) => ({
                      ...current,
                      [task.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="task-inline-field">
                <span>期日</span>
                <input
                  type="date"
                  value={draftDueDate}
                  onChange={(event) =>
                    setTaskDueDates((current) => ({
                      ...current,
                      [task.id]: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            {task.sourceSelectionText ? (
              <p className="task-selection-preview">{task.sourceSelectionText}</p>
            ) : null}

            {renderTagEditor(
              draftTags,
              taskTagInputs[task.id] ?? "",
              (value) =>
                setTaskTagInputs((current) => ({
                  ...current,
                  [task.id]: value,
                })),
              (rawTag) => {
                const nextTags = addTag(draftTags, rawTag);
                if (nextTags === draftTags) {
                  return;
                }

                setTaskTagInputs((current) => ({ ...current, [task.id]: "" }));
                setTaskDraftTags((current) => ({
                  ...current,
                  [task.id]: nextTags,
                }));
              },
              (tagToRemove) => {
                setTaskDraftTags((current) => ({
                  ...current,
                  [task.id]: removeTag(draftTags, tagToRemove),
                }));
              },
            )}

            <textarea
              className="task-note-textarea"
              rows={2}
              value={draftNoteText}
              onChange={(event) =>
                setTaskNotes((current) => ({
                  ...current,
                  [task.id]: event.target.value,
                }))
              }
              placeholder="2行メモ"
            />

            <div className="task-detail-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => resetTaskDraft(task)}
                disabled={!isTaskDirty}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => void saveTaskDetails(task)}
                disabled={!isTaskDirty}
              >
                確定
              </button>
            </div>
          </div>
        ) : null}
      </article>
    );
  };

  const renderModal = (content: ReactNode) => {
    if (typeof document === "undefined") {
      return content;
    }

    const appShell =
      workspaceRef.current?.closest(".app-shell") ?? document.querySelector(".app-shell");

    return createPortal(content, appShell ?? document.body);
  };

  const renderCreateTaskEditor = () => (
    <div className="task-board-create-panel task-create-modal-body">
      <div className="task-create-row">
        <input
          ref={createInputRef}
          className="task-create-input"
          type="text"
          value={newTaskTitle}
          onChange={(event) => setNewTaskTitle(event.target.value)}
          placeholder="タスクを入力"
        />
      </div>

      {initialSelectionText ? (
        <p className="task-selection-preview is-draft">{initialSelectionText}</p>
      ) : null}

      <div className="task-create-inline-options">
        <label className="task-attach-toggle">
          <input
            type="checkbox"
            checked={attachCurrentNote}
            onChange={(event) => {
              const checked = event.target.checked;
              setAttachCurrentNote(checked);
              if (checked) {
                setNewTaskSourceNoteId(currentNoteId ?? "");
              } else {
                setNewTaskSourceNoteId("");
              }
            }}
            disabled={!currentNoteId}
          />
          <span>現在のメモを紐付ける</span>
        </label>

        <label className="task-source-select">
          <span>元メモ</span>
          <select
            value={newTaskSourceNoteId}
            onChange={(event) => {
              setNewTaskSourceNoteId(event.target.value);
              setAttachCurrentNote(Boolean(event.target.value));
            }}
            disabled={notes.length === 0}
          >
            <option value="">メモを選択</option>
            {notes.map((note) => (
              <option key={note.id} value={note.id}>
                {note.title.trim() || "無題"}
              </option>
            ))}
          </select>
        </label>

        <div className="task-create-details">
          <label className="task-date-field task-estimate-field">
            <span>想定工数[H]</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={newTaskEstimatedHours}
              onChange={(event) => setNewTaskEstimatedHours(event.target.value)}
              placeholder="未設定"
            />
          </label>
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
      </div>

      <div className="task-create-progress">
        <span>進捗率</span>
        {renderProgressStepper(
          newTaskProgressPercent,
          (nextValue) => setNewTaskProgressPercent(normalizeProgressPercent(nextValue)),
          "新規タスクの進捗率",
        )}
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
  );

  return (
    <div
      ref={workspaceRef}
      className={`task-workspace${isActive ? "" : " is-hidden"}`}
      aria-hidden={!isActive}
    >
      <aside className="task-dashboard-panel">
        <div className="task-dashboard-header">
          <p className="eyebrow">タスクダッシュボード</p>
          <p className="task-dashboard-caption">
            {todaySprintSummary.calendarModeLabel} で集計
          </p>
        </div>

        <div className="task-dashboard-compact">
          <div
            className="task-progress-ring"
            style={{ "--task-progress-ratio": `${todaySprintSummary.ringPercent}%` } as CSSProperties}
          >
            <strong>
              {todaySprintSummary.activePercent === null
                ? "--"
                : `${todaySprintSummary.activePercent}%`}
            </strong>
            <span>今日の達成率</span>
          </div>
        </div>

        <div className="task-dashboard-scroll">
          <section
            className={`task-dashboard-card task-breakdown-card${
              isTodayBreakdownOpen ? " is-open" : ""
            }`}
          >
            <button
              type="button"
              className="task-breakdown-toggle"
              onClick={() => setIsTodayBreakdownOpen((current) => !current)}
              aria-expanded={isTodayBreakdownOpen}
            >
              <span>今日の内訳</span>
              <span className="task-breakdown-toggle-meta">{todayBreakdownItems.length} 件</span>
              <span className="task-breakdown-toggle-icon">
                {isTodayBreakdownOpen ? "▲" : "▼"}
              </span>
            </button>

            {isTodayBreakdownOpen ? (
              <div className="task-breakdown-list">
                {todayBreakdownItems.length === 0 ? (
                  <p className="task-dashboard-empty">今日やるタスクはありません</p>
                ) : (
                  todayBreakdownItems.map((item) => (
                    <article key={item.id} className="task-breakdown-item">
                      <strong className="task-breakdown-title">{item.title}</strong>
                      {item.currentProgress >= 100 ? (
                        <span className="task-breakdown-complete">完了</span>
                      ) : (
                        <>
                          <span className="task-breakdown-progress">
                            {`${item.currentProgress}%/${
                              item.targetToday === null ? "--" : `${Math.round(item.targetToday)}%`
                            }`}
                          </span>
                          <span className="task-breakdown-due">{item.dueLabel}</span>
                        </>
                      )}
                    </article>
                  ))
                )}
              </div>
            ) : null}
          </section>

          <div className="task-summary-card">
            <div className="task-summary-card-header">
              <span className="task-forecast-label">今日のスプリント</span>
              <small>{todaySprintSummary.calendarModeLabel}</small>
            </div>
            <strong>{todaySprintSummary.summaryStatus}</strong>
            <p>{todaySprintSummary.summaryBody}</p>
            <small>
              想定工数で重み付け
              {` / 未見積もり ${todaySprintSummary.unestimatedCount} 件`}
            </small>
          </div>

          <div className={`task-forecast-card is-${forecast.highestRiskDay?.level ?? "safe"}`}>
            <div className="task-forecast-card-header">
              <span className="task-forecast-label">炎上予報</span>
              <button
                type="button"
                className="ghost-button task-forecast-open-button"
                onClick={() => setIsForecastModalOpen(true)}
              >
                予報を見る
              </button>
            </div>
            <strong>{getForecastLabel(forecast.highestRiskDay?.level ?? "safe")}</strong>
            <p>
              {forecast.highestRiskDay && forecast.highestRiskDay.totalHours > 0
                ? `${forecast.highestRiskDay.label} ${formatForecastHours(
                    forecast.highestRiskDay.totalHours,
                  )}`
                : forecast.unestimatedCount > 0 || forecast.unscheduledCount > 0
                  ? `予報対象外 ${forecast.unestimatedCount + forecast.unscheduledCount} 件`
                  : "大きな詰まりはありません"}
            </p>
            <small className="task-forecast-card-meta">
              予報対象 {forecast.forecastableTaskCount} 件
            </small>
          </div>
          <div className="task-dashboard-detail">
          <section className="task-dashboard-card">
            <div className="task-dashboard-card-header">
              <h3>集計</h3>
              <span>今日やる基準</span>
            </div>
            <div className="task-kpi-grid">
              <div className="task-kpi-card">
                <strong>{todaySprintSummary.todayTaskCount}</strong>
                <span>今日やる</span>
              </div>
              <div className="task-kpi-card">
                <strong>{todaySprintSummary.eligibleCount}</strong>
                <span>計算対象</span>
              </div>
              <div className="task-kpi-card">
                <strong>{todaySprintSummary.preStartCount}</strong>
                <span>着手前</span>
              </div>
              <div className="task-kpi-card">
                <strong>{todaySprintSummary.unestimatedCount}</strong>
                <span>未見積もり</span>
              </div>
            </div>
          </section>
          </div>
        </div>
      </aside>

      <section className="task-board-panel">
        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}

        <div className="task-board-controls">
          <div className="field search-field">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="タスク・タグ・メモを検索"
            />
          </div>
          <label className="field task-board-filter">
            <span>タグ</span>
            <select
              value={activeTagFilter}
              onChange={(event) => setActiveTagFilter(event.target.value)}
            >
              <option value="__all__">すべて</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="field task-board-filter">
            <span>元メモ</span>
            <select
              value={activeSourceNoteFilter}
              onChange={(event) => setActiveSourceNoteFilter(event.target.value)}
            >
              <option value="__all__">すべて</option>
              {notes.map((note) => (
                <option key={note.id} value={note.id}>
                  {note.title.trim() || "無題"}
                </option>
              ))}
            </select>
          </label>
          <label className="field task-board-filter">
            <span>今日やる</span>
            <select
              value={activeTodayTaskFilter}
              onChange={(event) =>
                setActiveTodayTaskFilter(event.target.value as TodayTaskFilter)
              }
            >
              <option value="__all__">すべて</option>
              <option value="__today__">今日やるのみ</option>
            </select>
          </label>
          <label className="field task-board-filter">
            <span>並び順</span>
            <select
              value={taskSortKey}
              onChange={(event) => setTaskSortKey(event.target.value as TaskSortKey)}
            >
              <option value="updated_desc">更新日が新しい順</option>
              <option value="due_asc">期日が近い順</option>
              <option value="title_asc">タイトル順</option>
            </select>
          </label>
          <button
            type="button"
            className="ghost-button task-completed-toggle"
            onClick={() => setIsCompletedModalOpen(true)}
            disabled={groupedTasks.done.length === 0}
          >
            完了一覧
          </button>
        </div>

        <div className="task-board-canvas">
          {isLoading ? <div className="list-empty">タスクを読み込み中...</div> : null}

          {!isLoading ? (
            <>
              <section className="task-board-section">
                <div className="task-board-section-header">
                  <h3>未着手</h3>
                  <span>{groupedTasks.open.length} 件</span>
                </div>
                <div className="task-board-list">
                  {groupedTasks.open.length === 0 ? (
                    <div className="list-empty">未着手タスクはありません</div>
                  ) : (
                    groupedTasks.open.map(renderTaskRow)
                  )}
                </div>
              </section>

              <section className="task-board-section">
                <div className="task-board-section-header">
                  <h3>進行中</h3>
                  <span>{groupedTasks.in_progress.length} 件</span>
                </div>
                <div className="task-board-list">
                  {groupedTasks.in_progress.length === 0 ? (
                    <div className="list-empty">進行中タスクはありません</div>
                  ) : (
                    groupedTasks.in_progress.map(renderTaskRow)
                  )}
                </div>
              </section>

            </>
          ) : null}
        </div>

        {activeSourceNoteTitle ? (
          <div className="task-note-filter-banner">
            <span>元メモで絞り込み中: {activeSourceNoteTitle}</span>
            <button
              type="button"
              className="text-button"
              onClick={() => setActiveSourceNoteFilter("__all__")}
            >
              解除
            </button>
          </div>
        ) : null}
      </section>

      {isCompletedModalOpen ? renderModal(
        <div className="modal-backdrop" onClick={() => setIsCompletedModalOpen(false)}>
          <div
            className="modal-card completed-tasks-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="completed-tasks-header">
              <div>
                <p className="eyebrow">完了タスク</p>
                <h2>完了一覧</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsCompletedModalOpen(false)}
              >
                閉じる
              </button>
            </div>
            <div className="completed-tasks-list">
              {groupedTasks.done.length === 0 ? (
                <div className="list-empty">完了タスクはありません</div>
              ) : (
                groupedTasks.done.map(renderTaskRow)
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeForecastDay ? renderModal(
        <div className="modal-backdrop" onClick={() => setActiveForecastDay(null)}>
          <div
            className="modal-card task-forecast-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="completed-tasks-header">
              <div>
                <p className="eyebrow">炎上予報の内訳</p>
                <h2>{activeForecastDay.label}</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setActiveForecastDay(null)}
              >
                閉じる
              </button>
            </div>
            <div className="task-forecast-detail-summary">
              <span className={`task-detail-status-pill is-${activeForecastDay.level}`}>
                {getForecastLabel(activeForecastDay.level)}
              </span>
              <strong>{formatForecastHours(activeForecastDay.totalHours)}</strong>
            </div>
            <div className="task-forecast-detail-list">
              {activeForecastDay.contributions.length === 0 ? (
                <div className="list-empty">この日の負荷はありません</div>
              ) : (
                activeForecastDay.contributions.map((item) => (
                  <div key={`${activeForecastDay.key}-${item.taskId}`} className="task-forecast-detail-item">
                    <div>
                      <strong>{item.title}</strong>
                      <p>
                        進捗 {item.progressPercent}% / 期日 {formatDateLabel(item.dueDate)}
                        {item.sourceNoteTitle ? ` / ${item.sourceNoteTitle}` : ""}
                      </p>
                    </div>
                    <span>{formatForecastHours(item.requiredHours)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isCreateModalOpen ? renderModal(
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="modal-card task-create-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="completed-tasks-header">
              <div>
                <p className="eyebrow">新規タスク</p>
                <h2>タスクを追加</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsCreateModalOpen(false)}
              >
                閉じる
              </button>
            </div>
            {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
            {renderCreateTaskEditor()}
            <div className="task-create-modal-actions">
              <button
                type="button"
                className="primary-button task-create-button"
                onClick={() => void handleCreateTask()}
                disabled={!newTaskTitle.trim() || isCreating}
              >
                {isCreating ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isForecastModalOpen ? renderModal(
        <div className="modal-backdrop" onClick={() => setIsForecastModalOpen(false)}>
          <div
            className="modal-card task-forecast-overview-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="completed-tasks-header task-forecast-overview-header">
              <div>
                <p className="eyebrow">炎上予報</p>
                <h2>{forecast.mode === "weekly" ? "週間予報" : "月間予報"}</h2>
              </div>
              <div className="task-forecast-overview-actions">
                <div className="task-forecast-mode-toggle">
                  <button
                    type="button"
                    className={forecastMode === "weekly" ? "is-active" : ""}
                    onClick={() => setForecastMode("weekly")}
                  >
                    週間
                  </button>
                  <button
                    type="button"
                    className={forecastMode === "monthly" ? "is-active" : ""}
                    onClick={() => setForecastMode("monthly")}
                  >
                    月間
                  </button>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsForecastModalOpen(false)}
                >
                  閉じる
                </button>
              </div>
            </div>
            <div className="task-forecast-overview-body">
              <div className="task-forecast-overview-summary">
                <div className={`task-forecast-card is-${forecast.highestRiskDay?.level ?? "safe"}`}>
                  <span className="task-forecast-label">現在の予報</span>
                  <strong>{getForecastLabel(forecast.highestRiskDay?.level ?? "safe")}</strong>
                  <p>
                    {forecast.highestRiskDay && forecast.highestRiskDay.totalHours > 0
                      ? `${forecast.highestRiskDay.label} ${formatForecastHours(
                          forecast.highestRiskDay.totalHours,
                        )}`
                      : "大きな詰まりはありません"}
                  </p>
                </div>
                <div className="task-forecast-meta-list">
                  <div className="task-forecast-meta-item">
                    <span>予報対象</span>
                    <strong>{forecast.forecastableTaskCount} 件</strong>
                  </div>
                  <div className="task-forecast-meta-item">
                    <span>未見積もり</span>
                    <strong>{forecast.unestimatedCount} 件</strong>
                  </div>
                  <div className="task-forecast-meta-item">
                    <span>期日未設定</span>
                    <strong>{forecast.unscheduledCount} 件</strong>
                  </div>
                </div>
              </div>

              <div
                className={`task-forecast-grid task-forecast-grid-${forecast.mode}`}
                role="grid"
                aria-label={forecast.mode === "weekly" ? "週間炎上予報" : "月間炎上予報"}
              >
                {forecast.days.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    className={`task-forecast-grid-item is-${day.level}`}
                    onClick={() => setActiveForecastDay(day)}
                  >
                    <span className="task-forecast-grid-date">
                      {day.shortLabel}
                      <small>{day.weekdayLabel}</small>
                    </span>
                    <strong>{formatForecastHours(day.totalHours)}</strong>
                    <em className={`task-forecast-badge is-${day.level}`}>
                      {getForecastLabel(day.level)}
                    </em>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
