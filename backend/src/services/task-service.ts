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
    const sourceNoteTags =
      input.sourceNoteId ? this.noteRepository.getTagNamesForNote(input.sourceNoteId) : [];
    const tags = sanitizeTags(input.tags ?? sourceNoteTags);
    this.taskRepository.create({
      id: crypto.randomUUID(),
      title: input.title.trim(),
      status: input.status ?? "open",
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
    const nextStatus = input.status ?? existing.status;
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

    assertStatus(nextStatus);

    if (nextSourceNoteId && !this.noteRepository.noteExists(nextSourceNoteId)) {
      throw new HttpError(404, "NOT_FOUND", "source note was not found");
    }

    this.taskRepository.update({
      id,
      title: nextTitle,
      status: nextStatus,
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
