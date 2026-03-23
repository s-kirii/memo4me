import { Router } from "express";
import { AiExecutionService } from "../services/ai-execution-service";
import { AiSettingsService } from "../services/ai-settings-service";
import { TaskService } from "../services/task-service";
import { HttpError } from "../utils/http-error";
import { NoteService } from "../services/note-service";
import type {
  AiConnectionTestInput,
  AiRunNoteInput,
  AiSettingsInput,
  NoteInput,
  TaskBulkCreateInput,
  TaskInput,
  TaskUpdateInput,
} from "../types";

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

function parseAiRunNoteInput(body: unknown): AiRunNoteInput {
  const payload = body as Partial<AiRunNoteInput>;

  return {
    action: typeof payload.action === "string" ? payload.action : "summary",
    prompt: typeof payload.prompt === "string" ? payload.prompt : undefined,
  };
}

function parseTaskInput(body: unknown): TaskInput {
  const payload = body as Partial<TaskInput>;

  return {
    title: typeof payload.title === "string" ? payload.title : "",
    status: typeof payload.status === "string" ? payload.status : undefined,
    isTodayTask: typeof payload.isTodayTask === "boolean" ? payload.isTodayTask : undefined,
    estimatedHours:
      typeof payload.estimatedHours === "number" ? payload.estimatedHours : null,
    progressPercent:
      typeof payload.progressPercent === "number" ? payload.progressPercent : undefined,
    tags: Array.isArray(payload.tags) ? payload.tags : undefined,
    startTargetDate:
      typeof payload.startTargetDate === "string" ? payload.startTargetDate : null,
    dueDate: typeof payload.dueDate === "string" ? payload.dueDate : null,
    noteText: typeof payload.noteText === "string" ? payload.noteText : null,
    sourceNoteId:
      typeof payload.sourceNoteId === "string" ? payload.sourceNoteId : null,
    sourceSelectionText:
      typeof payload.sourceSelectionText === "string"
        ? payload.sourceSelectionText
        : null,
    createdBy:
      typeof payload.createdBy === "string" ? payload.createdBy : undefined,
  };
}

function parseTaskUpdateInput(body: unknown): TaskUpdateInput {
  const payload = body as Partial<TaskUpdateInput>;

  return {
    title: typeof payload.title === "string" ? payload.title : undefined,
    status: typeof payload.status === "string" ? payload.status : undefined,
    isTodayTask:
      typeof payload.isTodayTask === "boolean" ? payload.isTodayTask : undefined,
    estimatedHours:
      typeof payload.estimatedHours === "number"
        ? payload.estimatedHours
        : payload.estimatedHours === null
          ? null
          : undefined,
    progressPercent:
      typeof payload.progressPercent === "number" ? payload.progressPercent : undefined,
    tags: Array.isArray(payload.tags) ? payload.tags : undefined,
    sourceNoteId:
      typeof payload.sourceNoteId === "string"
        ? payload.sourceNoteId
        : payload.sourceNoteId === null
          ? null
          : undefined,
    startTargetDate:
      typeof payload.startTargetDate === "string"
        ? payload.startTargetDate
        : payload.startTargetDate === null
          ? null
          : undefined,
    dueDate:
      typeof payload.dueDate === "string"
        ? payload.dueDate
        : payload.dueDate === null
          ? null
          : undefined,
    noteText:
      typeof payload.noteText === "string"
        ? payload.noteText
        : payload.noteText === null
          ? null
          : undefined,
  };
}

function parseTaskBulkCreateInput(body: unknown): TaskBulkCreateInput {
  const payload = body as Partial<TaskBulkCreateInput>;

  return {
    items: Array.isArray(payload.items)
      ? payload.items.map((item) => parseTaskInput(item))
      : [],
  };
}

export function createApiRouter(
  noteService: NoteService,
  aiSettingsService: AiSettingsService,
  aiExecutionService: AiExecutionService,
  taskService: TaskService,
  onShutdown?: () => void,
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

  router.get("/notes/:id/ai-outputs", (req, res) => {
    const items = aiExecutionService.listOutputsForNote(req.params.id);
    res.json({ items });
  });

  router.post("/notes/:id/ai/run", async (req, res, next) => {
    try {
      const item = await aiExecutionService.runForNote(
        req.params.id,
        parseAiRunNoteInput(req.body),
      );
      res.status(201).json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.post("/notes/:id/ai/task-candidates", async (req, res, next) => {
    try {
      const result = await aiExecutionService.extractTaskCandidatesForNote(
        req.params.id,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/tasks", (_req, res) => {
    const items = taskService.listTasks();
    res.json({ items });
  });

  router.post("/tasks", (req, res) => {
    const item = taskService.createTask(parseTaskInput(req.body));
    res.status(201).json({ item });
  });

  router.post("/tasks/bulk", (req, res) => {
    const items = taskService.createTasks(parseTaskBulkCreateInput(req.body).items);
    res.status(201).json({ items });
  });

  router.put("/tasks/:id", (req, res) => {
    const item = taskService.updateTask(req.params.id, parseTaskUpdateInput(req.body));
    res.json({ item });
  });

  router.delete("/tasks/:id", (req, res) => {
    const result = taskService.deleteTask(req.params.id);
    res.json(result);
  });

  router.post("/app/shutdown", (_req, res) => {
    res.json({
      ok: true as const,
      message: "memo4me を終了しています。このタブを閉じてください。",
    });

    if (onShutdown) {
      setTimeout(() => {
        onShutdown();
      }, 150);
    }
  });

  router.use((_req, _res, next) => {
    next(new HttpError(404, "NOT_FOUND", "route was not found"));
  });

  return router;
}
