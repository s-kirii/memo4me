import { HttpError } from "../utils/http-error";
import { extractPlainText } from "../utils/content";
import { sanitizeTags } from "../utils/tags";
import { NoteRepository } from "../repositories/note-repository";
import { TagRepository } from "../repositories/tag-repository";
import type { ListNotesParams, NoteInput } from "../types";

export class NoteService {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly tagRepository: TagRepository,
  ) {}

  listNotes(params: ListNotesParams) {
    return this.noteRepository.list(params);
  }

  getNote(id: string) {
    const note = this.noteRepository.findById(id);
    if (!note) {
      throw new HttpError(404, "NOT_FOUND", "note was not found");
    }

    return note;
  }

  createNote(input: NoteInput) {
    this.validateInput(input);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const contentPlain = extractPlainText(input.contentMd);
    const tags = sanitizeTags(input.tags);

    this.noteRepository.create({
      id,
      title: input.title,
      contentMd: input.contentMd,
      contentPlain,
      createdAt: now,
      updatedAt: now,
    });
    this.noteRepository.upsertTagsForNote(id, tags);

    return this.getNote(id);
  }

  updateNote(id: string, input: NoteInput) {
    this.validateInput(input);

    if (!this.noteRepository.noteExists(id)) {
      throw new HttpError(404, "NOT_FOUND", "note was not found");
    }

    this.noteRepository.update({
      id,
      title: input.title,
      contentMd: input.contentMd,
      contentPlain: extractPlainText(input.contentMd),
      updatedAt: new Date().toISOString(),
    });
    this.noteRepository.upsertTagsForNote(id, sanitizeTags(input.tags));

    return this.getNote(id);
  }

  deleteNote(id: string) {
    if (!this.noteRepository.noteExists(id)) {
      throw new HttpError(404, "NOT_FOUND", "note was not found");
    }

    this.noteRepository.delete(id);
    return { ok: true };
  }

  listTags() {
    return this.tagRepository.list();
  }

  private validateInput(input: NoteInput) {
    if (typeof input.title !== "string") {
      throw new HttpError(400, "VALIDATION_ERROR", "title must be a string");
    }

    if (typeof input.contentMd !== "string") {
      throw new HttpError(400, "VALIDATION_ERROR", "contentMd must be a string");
    }

    if (!Array.isArray(input.tags)) {
      throw new HttpError(400, "VALIDATION_ERROR", "tags must be an array");
    }

    if (input.title.length > 200) {
      throw new HttpError(400, "VALIDATION_ERROR", "title is too long");
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
