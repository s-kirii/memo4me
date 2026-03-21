import { Router } from "express";
import { AiSettingsService } from "../services/ai-settings-service";
import { HttpError } from "../utils/http-error";
import { NoteService } from "../services/note-service";
import type { AiConnectionTestInput, AiSettingsInput, NoteInput } from "../types";

function parseNoteInput(body: unknown): NoteInput {
  const payload = body as Partial<NoteInput>;

  return {
    title: payload.title ?? "",
    contentMd: payload.contentMd ?? "",
    tags: payload.tags ?? [],
  };
}

function parseAiSettingsInput(body: unknown): AiSettingsInput {
  const payload = body as Partial<AiSettingsInput>;

  return {
    activeProvider:
      typeof payload.activeProvider === "string"
        ? payload.activeProvider
        : "openai_compatible",
    providers: Array.isArray(payload.providers) ? payload.providers : [],
  };
}

function parseAiConnectionTestInput(body: unknown): AiConnectionTestInput {
  const payload = body as Partial<AiConnectionTestInput>;

  return {
    provider:
      typeof payload.provider === "string"
        ? payload.provider
        : "openai_compatible",
    endpoint: typeof payload.endpoint === "string" ? payload.endpoint : undefined,
    model: typeof payload.model === "string" ? payload.model : undefined,
    apiKey: typeof payload.apiKey === "string" ? payload.apiKey : undefined,
  };
}

export function createApiRouter(
  noteService: NoteService,
  aiSettingsService: AiSettingsService,
) {
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

  router.get("/ai/settings", (_req, res) => {
    const settings = aiSettingsService.getSettings();
    res.json(settings);
  });

  router.put("/ai/settings", (req, res) => {
    const settings = aiSettingsService.updateSettings(parseAiSettingsInput(req.body));
    res.json(settings);
  });

  router.post("/ai/settings/test", async (req, res, next) => {
    try {
      const result = await aiSettingsService.testConnection(
        parseAiConnectionTestInput(req.body),
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.use((_req, _res, next) => {
    next(new HttpError(404, "NOT_FOUND", "route was not found"));
  });

  return router;
}
