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

function getDueState(value: string | null) {
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

function getStartTargetState(value: string | null, status: TaskStatus) {
  if (!value || status !== "open") {
    return "none" as const;
  }

  const targetDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(targetDate.getTime())) {
    return "none" as const;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return targetDate.getTime() < today.getTime() ? "late" : "none";
}

function getForecastLevel(input: {
  overdueCount: number;
  dueTodayCount: number;
  lateStartCount: number;
  inProgressCount: number;
}) {
  const score =
    input.overdueCount * 3 +
    input.dueTodayCount * 2 +
    input.lateStartCount +
    (input.inProgressCount >= 6 ? 1 : 0);

  if (score >= 6) {
    return "risk" satisfies FireForecastLevel;
  }

  if (score >= 2) {
    return "watch" satisfies FireForecastLevel;
  }

  return "safe" satisfies FireForecastLevel;
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

function getForecastBody(input: {
  overdueCount: number;
  dueTodayCount: number;
  lateStartCount: number;
}) {
  if (input.overdueCount > 0) {
    return `期限超過 ${input.overdueCount} 件`;
  }
  if (input.dueTodayCount > 0) {
    return `本日期限 ${input.dueTodayCount} 件`;
  }
  if (input.lateStartCount > 0) {
    return `未着手の遅延 ${input.lateStartCount} 件`;
  }
  return "大きな詰まりはありません";
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
  if (task.status === "done") {
    return false;
  }

  const startDate = parseDateOnly(task.startTargetDate);
  if (!startDate) {
    return false;
  }

  return isSameOrAfter(referenceDate, startDate);
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
      const effectiveTodayTask = isEffectiveTodayTask(task, today);
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
        activeTodayTaskFilter === "__all__" || effectiveTodayTask;

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

  const allMetrics = useMemo(() => {
    const totalCount = filteredTasks.length;
    const openCount = filteredTasks.filter((task) => task.status === "open").length;
    const inProgressCount = filteredTasks.filter((task) => task.status === "in_progress").length;
    const doneCount = filteredTasks.filter((task) => task.status === "done").length;
    const today = startOfToday();
    const todayTaskCount = filteredTasks.filter((task) => isEffectiveTodayTask(task, today)).length;
    const overdueCount = filteredTasks.filter(
      (task) => task.status !== "done" && getDueState(task.dueDate) === "overdue",
    ).length;
    const dueTodayCount = filteredTasks.filter(
      (task) => task.status !== "done" && getDueState(task.dueDate) === "today",
    ).length;
    const lateStartCount = filteredTasks.filter(
      (task) => getStartTargetState(task.startTargetDate, task.status) === "late",
    ).length;

    const tagStats = new Map<
      string,
      { total: number; done: number; active: number }
    >();
    for (const task of filteredTasks) {
      for (const tag of task.tags) {
        const current = tagStats.get(tag) ?? { total: 0, done: 0, active: 0 };
        current.total += 1;
        if (task.status === "done") {
          current.done += 1;
        } else {
          current.active += 1;
        }
        tagStats.set(tag, current);
      }
    }

    const topTags = [...tagStats.entries()]
      .sort((left, right) => right[1].total - left[1].total)
      .slice(0, 5)
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        done: stat.done,
        active: stat.active,
        completionRatio: stat.total === 0 ? 0 : Math.round((stat.done / stat.total) * 100),
      }));

    const completionRatio =
      totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
    const forecastLevel = getForecastLevel({
      overdueCount,
      dueTodayCount,
      lateStartCount,
      inProgressCount,
    });

    return {
      totalCount,
      openCount,
      inProgressCount,
      doneCount,
      todayTaskCount,
      overdueCount,
      dueTodayCount,
      lateStartCount,
      completionRatio,
      forecastLevel,
      forecastLabel: getForecastLabel(forecastLevel),
      forecastBody: getForecastBody({
        overdueCount,
        dueTodayCount,
        lateStartCount,
      }),
      topTags,
    };
  }, [filteredTasks]);

  const todaySprintSummary = useMemo(() => {
    const today = startOfToday();
    const previousDay = addDays(today, -1);
    const todayTasks = filteredTasks.filter(
      (task) => isEffectiveTodayTask(task, today) && task.status !== "done",
    );

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
    const dueState = getDueState(task.dueDate);
    const isExpanded = expandedTaskId === task.id;
    const effectiveTodayTask = isEffectiveTodayTask(task);

    return (
      <article
        key={task.id}
        className={`task-board-row${isExpanded ? " is-expanded" : ""}${task.status === "done" ? " is-done" : ""}${dueState === "today" ? " is-due-today" : ""}${dueState === "overdue" ? " is-overdue" : ""}`}
      >
        <div className="task-board-row-summary">
          <label className="task-board-row-main">
            <input
              type="checkbox"
              checked={effectiveTodayTask}
              disabled
              title={
                task.status === "done"
                  ? "完了タスクは今日やる対象外です"
                  : effectiveTodayTask
                    ? "着手日以降のため自動で今日やるに含まれています"
                    : "着手日までは今日やるに含まれません"
              }
              aria-label={
                effectiveTodayTask
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
            <span className={`task-row-status is-${task.status}`}>{getStatusLabel(task.status)}</span>
            <span className="task-row-progress">{task.progressPercent}%</span>
            {effectiveTodayTask ? <span className="task-row-today">今日やる</span> : null}
            <div className="task-row-tags">
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
            className="ghost-button task-expand-button"
            aria-label={isExpanded ? "詳細を閉じる" : "詳細を表示"}
            title={isExpanded ? "詳細を閉じる" : "詳細を表示"}
            onClick={() => setExpandedTaskId((current) => (current === task.id ? null : task.id))}
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
                  value={task.sourceNoteId ?? ""}
                  onChange={(event) =>
                    void updateTask(task.id, {
                      sourceNoteId: event.target.value || null,
                    })
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
                {task.sourceNoteId ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onOpenNote(task.sourceNoteId as string)}
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
                  taskProgressPercents[task.id] ?? task.progressPercent,
                  (nextValue) => {
                    setTaskProgressPercents((current) => ({
                      ...current,
                      [task.id]: nextValue,
                    }));
                    void updateTask(task.id, {
                      progressPercent: nextValue,
                    });
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
                  value={taskEstimatedHours[task.id] ?? (task.estimatedHours?.toString() ?? "")}
                  onChange={(event) =>
                    setTaskEstimatedHours((current) => ({
                      ...current,
                      [task.id]: event.target.value,
                    }))
                  }
                  onBlur={(event) =>
                    void updateTask(task.id, {
                      estimatedHours:
                        event.target.value.trim() === ""
                          ? null
                          : Number(event.target.value),
                    })
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
              <label className="task-inline-field">
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

            {task.sourceSelectionText ? (
              <p className="task-selection-preview">{task.sourceSelectionText}</p>
            ) : null}

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
                void updateTask(task.id, { tags: nextTags });
              },
              (tagToRemove) => {
                void updateTask(task.id, { tags: removeTag(task.tags, tagToRemove) });
              },
            )}

            <textarea
              className="task-note-textarea"
              rows={2}
              value={taskNotes[task.id] ?? task.noteText ?? ""}
              onChange={(event) =>
                setTaskNotes((current) => ({
                  ...current,
                  [task.id]: event.target.value,
                }))
              }
              onBlur={(event) =>
                void updateTask(task.id, {
                  noteText: event.target.value || null,
                })
              }
              placeholder="2行メモ"
            />
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
          <div>
            <p className="eyebrow">タスクダッシュボード</p>
            <h2>状況サマリー</h2>
          </div>
          <p className="task-dashboard-caption">
            今日やるタスクを中心に {todaySprintSummary.calendarModeLabel} で集計
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
          </div>
        </div>

        <div className="task-dashboard-detail">
          <section className="task-dashboard-card">
            <div className="task-dashboard-card-header">
              <h3>今日の内訳</h3>
              <span>{todaySprintSummary.calendarModeLabel}</span>
            </div>
            <div className="task-dashboard-bars">
              <div className="task-dashboard-bar-row">
                <span>今日やる</span>
                <div className="task-dashboard-bar-track is-static" />
                <strong>{todaySprintSummary.todayTaskCount}</strong>
              </div>
              <div className="task-dashboard-bar-row">
                <span>計算対象</span>
                <div className="task-dashboard-bar-track is-static" />
                <strong>{todaySprintSummary.eligibleCount}</strong>
              </div>
              <div className="task-dashboard-bar-row">
                <span>着手前</span>
                <div className="task-dashboard-bar-track is-static" />
                <strong>{todaySprintSummary.preStartCount}</strong>
              </div>
              <div className="task-dashboard-bar-row">
                <span>日付未設定</span>
                <div className="task-dashboard-bar-track is-static" />
                <strong>{todaySprintSummary.unscheduledCount}</strong>
              </div>
            </div>
          </section>

          <section className="task-dashboard-card">
            <div className="task-dashboard-card-header">
              <h3>計算メモ</h3>
              <span>単一指標</span>
            </div>
            <ul className="task-dashboard-list">
              <li>表示方式: 今日の目標に対して今どこにいるか</li>
              <li>日数計算: {todaySprintSummary.calendarModeLabel}</li>
              <li>集計: 想定工数で重み付け</li>
              <li>着手日前のタスク: 計算対象外</li>
              <li>未見積もり: {todaySprintSummary.unestimatedCount} 件</li>
              <li>日付未設定: {todaySprintSummary.unscheduledCount} 件</li>
            </ul>
          </section>

          <section className="task-dashboard-card">
            <div className="task-dashboard-card-header">
              <h3>炎上予報</h3>
              <span>{forecastMode === "weekly" ? "週間基準" : "月間基準"}</span>
            </div>
            <div className="task-forecast-summary">
              <strong>
                {forecast.highestRiskDay && forecast.highestRiskDay.totalHours > 0
                  ? `${forecast.highestRiskDay.label} ${getForecastLabel(
                      forecast.highestRiskDay.level,
                    )}`
                  : "週間の負荷を表示します"}
              </strong>
              <span>{`予報対象 ${forecast.forecastableTaskCount} 件`}</span>
            </div>
            <ul className="task-dashboard-list">
              <li>期限超過: {allMetrics.overdueCount} 件</li>
              <li>本日期限: {allMetrics.dueTodayCount} 件</li>
              <li>今日やる: {allMetrics.todayTaskCount} 件</li>
              <li>着手遅延: {allMetrics.lateStartCount} 件</li>
              <li>未見積もり: {forecast.unestimatedCount} 件</li>
              <li>期日未設定: {forecast.unscheduledCount} 件</li>
            </ul>
            <button
              type="button"
              className="ghost-button task-forecast-open-secondary"
              onClick={() => setIsForecastModalOpen(true)}
            >
              詳細な予報を開く
            </button>
          </section>
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
