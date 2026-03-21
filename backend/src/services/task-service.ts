import { NoteRepository } from "../repositories/note-repository";
import { TaskRepository } from "../repositories/task-repository";
import type { TaskInput, TaskItem, TaskUpdateInput } from "../types";
import { HttpError } from "../utils/http-error";

function assertStatus(value: string): asserts value is "open" | "done" {
  if (value !== "open" && value !== "done") {
    throw new HttpError(400, "VALIDATION_ERROR", "task status is invalid");
  }
}

function assertCreatedBy(value: string): asserts value is "manual" | "ai" {
  if (value !== "manual" && value !== "ai") {
    throw new HttpError(400, "VALIDATION_ERROR", "task createdBy is invalid");
  }
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
    this.taskRepository.create({
      id: crypto.randomUUID(),
      title: input.title.trim(),
      status: input.status ?? "open",
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

    if (!nextTitle) {
      throw new HttpError(400, "VALIDATION_ERROR", "task title is required");
    }

    if (nextTitle.length > 200) {
      throw new HttpError(400, "VALIDATION_ERROR", "task title is too long");
    }

    assertStatus(nextStatus);

    this.taskRepository.update({
      id,
      title: nextTitle,
      status: nextStatus,
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
  }
}
