import { Router } from "express";
import { HttpError } from "../utils/http-error";
import { NoteService } from "../services/note-service";
import type { NoteInput } from "../types";

function parseNoteInput(body: unknown): NoteInput {
  const payload = body as Partial<NoteInput>;

  return {
    title: payload.title ?? "",
    contentMd: payload.contentMd ?? "",
    tags: payload.tags ?? [],
  };
}

export function createApiRouter(noteService: NoteService) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.get("/notes", (req, res) => {
    const items = noteService.listNotes({
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      tag: typeof req.query.tag === "string" ? req.query.tag : undefined,
      sort: typeof req.query.sort === "string" ? req.query.sort : undefined,
    });

    res.json({ items });
  });

  router.get("/notes/:id", (req, res) => {
    const note = noteService.getNote(req.params.id);
    res.json(note);
  });

  router.post("/notes", (req, res) => {
    const note = noteService.createNote(parseNoteInput(req.body));
    res.status(201).json(note);
  });

  router.put("/notes/:id", (req, res) => {
    const note = noteService.updateNote(req.params.id, parseNoteInput(req.body));
    res.json(note);
  });

  router.delete("/notes/:id", (req, res) => {
    const result = noteService.deleteNote(req.params.id);
    res.json(result);
  });

  router.get("/tags", (_req, res) => {
    const items = noteService.listTags();
    res.json({ items });
  });

  router.use((_req, _res, next) => {
    next(new HttpError(404, "NOT_FOUND", "route was not found"));
  });

  return router;
}
