import { sanitizeTags } from "../utils/tags";
import { NoteRepository } from "../repositories/note-repository";
import { TaskRepository } from "../repositories/task-repository";
import type { TaskInput, TaskItem, TaskUpdateInput } from "../types";
import { HttpError } from "../utils/http-error";

function assertStatus(value: string): asserts value is "open" | "in_progress" | "done" {
  if (value !== "open" && value !== "in_progress" && value !== "done") {
    throw new HttpError(400, "VALIDATION_ERROR", "task status is invalid");
  }
}

function assertCreatedBy(value: string): asserts value is "manual" | "ai" {
  if (value !== "manual" && value !== "ai") {
    throw new HttpError(400, "VALIDATION_ERROR", "task createdBy is invalid");
  }
}

function normalizeDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new HttpError(400, "VALIDATION_ERROR", "task date must be YYYY-MM-DD");
  }

  return trimmed;
}

function normalizeTaskNote(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized ? normalized : null;
}

function normalizeEstimatedHours(value: number | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Number.isFinite(value)) {
    throw new HttpError(400, "VALIDATION_ERROR", "estimatedHours must be a number");
  }

  if (value < 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "estimatedHours must not be negative");
  }

  if (value > 9999) {
    throw new HttpError(400, "VALIDATION_ERROR", "estimatedHours is too large");
  }

  return Math.round(value * 10) / 10;
}

function statusToProgressPercent(status: "open" | "in_progress" | "done") {
  if (status === "done") {
    return 100;
  }

  if (status === "in_progress") {
    return 10;
  }

  return 0;
}

function normalizeProgressPercent(
  value: number | undefined,
  fallbackStatus?: "open" | "in_progress" | "done",
) {
  if (value === undefined) {
    return fallbackStatus ? statusToProgressPercent(fallbackStatus) : 0;
  }

  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "progressPercent must be an integer between 0 and 100",
    );
  }

  if (value % 10 !== 0) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "progressPercent must be in 10 percent increments",
    );
  }

  return value;
}

function progressPercentToStatus(progressPercent: number): "open" | "in_progress" | "done" {
  if (progressPercent >= 100) {
    return "done";
  }

  if (progressPercent > 0) {
    return "in_progress";
  }

  return "open";
}

export class TaskService {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly noteRepository: NoteRepository,
  ) {}

  listTasks() {
    return this.taskRepository.list();
  }

  createTask(input: TaskInput) {
    this.validateCreateInput(input);

    if (input.sourceNoteId && !this.noteRepository.noteExists(input.sourceNoteId)) {
      throw new HttpError(404, "NOT_FOUND", "source note was not found");
    }

    const now = new Date().toISOString();
    const progressPercent = normalizeProgressPercent(input.progressPercent, input.status);
    const nextStatus = progressPercentToStatus(progressPercent);
    const sourceNoteTags =
      input.sourceNoteId ? this.noteRepository.getTagNamesForNote(input.sourceNoteId) : [];
    const tags = sanitizeTags(input.tags ?? sourceNoteTags);
    this.taskRepository.create({
      id: crypto.randomUUID(),
      title: input.title.trim(),
      status: nextStatus,
      isTodayTask: nextStatus === "done" ? false : (input.isTodayTask ?? false),
      estimatedHours: normalizeEstimatedHours(input.estimatedHours),
      progressPercent,
      tags,
      startTargetDate: normalizeDate(input.startTargetDate),
      dueDate: normalizeDate(input.dueDate),
      noteText: normalizeTaskNote(input.noteText),
      sourceNoteId: input.sourceNoteId ?? null,
      sourceSelectionText: input.sourceSelectionText?.trim() || null,
      createdBy: input.createdBy ?? "manual",
      createdAt: now,
      updatedAt: now,
    });

    return this.taskRepository.list()[0] ?? null;
  }

  createTasks(items: TaskInput[]): TaskItem[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "items are required");
    }

    if (items.length > 50) {
      throw new HttpError(400, "VALIDATION_ERROR", "too many tasks requested");
    }

    const createdIds = items.map((item) => this.createTask(item)?.id).filter(Boolean);

    return createdIds
      .map((id) => this.taskRepository.findById(id as string))
      .filter((item): item is TaskItem => item !== null);
  }

  updateTask(id: string, input: TaskUpdateInput) {
    const existing = this.taskRepository.findById(id);
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "task was not found");
    }

    const nextTitle = input.title !== undefined ? input.title.trim() : existing.title;
    const nextProgressPercent = normalizeProgressPercent(
      input.progressPercent,
      input.status,
    );
    const resolvedProgressPercent =
      input.progressPercent !== undefined || input.status !== undefined
        ? nextProgressPercent
        : existing.progressPercent;
    const nextStatus = progressPercentToStatus(resolvedProgressPercent);
    const nextIsTodayTask =
      nextStatus === "done"
        ? false
        : input.isTodayTask !== undefined
          ? input.isTodayTask
          : existing.isTodayTask;
    const nextEstimatedHours = normalizeEstimatedHours(
      input.estimatedHours !== undefined ? input.estimatedHours : existing.estimatedHours,
    );
    const nextTags = sanitizeTags(input.tags ?? existing.tags);
    const nextSourceNoteId =
      input.sourceNoteId !== undefined ? input.sourceNoteId : existing.sourceNoteId;
    const nextStartTargetDate = normalizeDate(
      input.startTargetDate !== undefined ? input.startTargetDate : existing.startTargetDate,
    );
    const nextDueDate = normalizeDate(
      input.dueDate !== undefined ? input.dueDate : existing.dueDate,
    );
    const nextNoteText = normalizeTaskNote(
      input.noteText !== undefined ? input.noteText : existing.noteText,
    );

    if (!nextTitle) {
      throw new HttpError(400, "VALIDATION_ERROR", "task title is required");
    }

    if (nextTitle.length > 200) {
      throw new HttpError(400, "VALIDATION_ERROR", "task title is too long");
    }

    if (input.isTodayTask !== undefined && typeof input.isTodayTask !== "boolean") {
      throw new HttpError(400, "VALIDATION_ERROR", "isTodayTask must be a boolean");
    }

    if (nextSourceNoteId && !this.noteRepository.noteExists(nextSourceNoteId)) {
      throw new HttpError(404, "NOT_FOUND", "source note was not found");
    }

    this.taskRepository.update({
      id,
      title: nextTitle,
      status: nextStatus,
      isTodayTask: nextIsTodayTask,
      estimatedHours: nextEstimatedHours,
      progressPercent: resolvedProgressPercent,
      tags: nextTags,
      sourceNoteId: nextSourceNoteId ?? null,
      startTargetDate: nextStartTargetDate,
      dueDate: nextDueDate,
      noteText: nextNoteText,
      updatedAt: new Date().toISOString(),
    });

    return this.taskRepository.findById(id);
  }

  deleteTask(id: string) {
    const existing = this.taskRepository.findById(id);
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "task was not found");
    }

    this.taskRepository.delete(id);
    return { ok: true as const };
  }

  private validateCreateInput(input: TaskInput) {
    if (typeof input.title !== "string" || !input.title.trim()) {
      throw new HttpError(400, "VALIDATION_ERROR", "task title is required");
    }

    if (input.title.trim().length > 200) {
      throw new HttpError(400, "VALIDATION_ERROR", "task title is too long");
    }

    if (input.status !== undefined) {
      assertStatus(input.status);
    }

    if (input.isTodayTask !== undefined && typeof input.isTodayTask !== "boolean") {
      throw new HttpError(400, "VALIDATION_ERROR", "isTodayTask must be a boolean");
    }

    if (input.estimatedHours !== undefined && input.estimatedHours !== null) {
      if (typeof input.estimatedHours !== "number") {
        throw new HttpError(400, "VALIDATION_ERROR", "estimatedHours must be a number");
      }
    }

    if (input.progressPercent !== undefined) {
      if (typeof input.progressPercent !== "number") {
        throw new HttpError(400, "VALIDATION_ERROR", "progressPercent must be a number");
      }
    }

    if (
      input.sourceNoteId !== undefined &&
      input.sourceNoteId !== null &&
      typeof input.sourceNoteId !== "string"
    ) {
      throw new HttpError(400, "VALIDATION_ERROR", "sourceNoteId must be a string");
    }

    if (
      input.startTargetDate !== undefined &&
      input.startTargetDate !== null &&
      typeof input.startTargetDate !== "string"
    ) {
      throw new HttpError(400, "VALIDATION_ERROR", "startTargetDate must be a string");
    }

    if (
      input.dueDate !== undefined &&
      input.dueDate !== null &&
      typeof input.dueDate !== "string"
    ) {
      throw new HttpError(400, "VALIDATION_ERROR", "dueDate must be a string");
    }

    if (
      input.noteText !== undefined &&
      input.noteText !== null &&
      typeof input.noteText !== "string"
    ) {
      throw new HttpError(400, "VALIDATION_ERROR", "noteText must be a string");
    }

    if (typeof input.noteText === "string" && input.noteText.trim().length > 300) {
      throw new HttpError(400, "VALIDATION_ERROR", "noteText is too long");
    }

    if (
      input.sourceSelectionText !== undefined &&
      input.sourceSelectionText !== null &&
      typeof input.sourceSelectionText !== "string"
    ) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "sourceSelectionText must be a string",
      );
    }

    if (input.createdBy !== undefined) {
      assertCreatedBy(input.createdBy);
    }

    if (input.tags !== undefined) {
      if (!Array.isArray(input.tags)) {
        throw new HttpError(400, "VALIDATION_ERROR", "tags must be an array");
      }

      if (input.tags.length > 10) {
        throw new HttpError(400, "VALIDATION_ERROR", "too many tags");
      }

      for (const tag of input.tags) {
        if (typeof tag !== "string") {
          throw new HttpError(400, "VALIDATION_ERROR", "tag must be a string");
        }

        if (tag.trim().length > 30) {
          throw new HttpError(400, "VALIDATION_ERROR", "tag is too long");
        }
      }
    }
  }
}
