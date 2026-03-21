import { PlatformSecretStore } from "./ai/platform-secret-store";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import type { AppDatabase } from "./db/database";
import { config } from "./config";
import { AiSettingsRepository } from "./repositories/ai-settings-repository";
import { AiOutputRepository } from "./repositories/ai-output-repository";
import { NoteRepository } from "./repositories/note-repository";
import { TaskRepository } from "./repositories/task-repository";
import { TagRepository } from "./repositories/tag-repository";
import { AiExecutionService } from "./services/ai-execution-service";
import { AiSettingsService } from "./services/ai-settings-service";
import { NoteService } from "./services/note-service";
import { TaskService } from "./services/task-service";
import { createApiRouter } from "./routes/api";
import { HttpError } from "./utils/http-error";

export function createApp(db: AppDatabase) {
  const app = express();
  const noteRepository = new NoteRepository(db);
  const tagRepository = new TagRepository(db);
  const aiSettingsRepository = new AiSettingsRepository(db);
  const aiOutputRepository = new AiOutputRepository(db);
  const taskRepository = new TaskRepository(db);
  const secretStore = new PlatformSecretStore();
  const noteService = new NoteService(noteRepository, tagRepository);
  const aiSettingsService = new AiSettingsService(
    aiSettingsRepository,
    secretStore,
  );
  const aiExecutionService = new AiExecutionService(
    noteRepository,
    aiSettingsService,
    aiOutputRepository,
  );
  const taskService = new TaskService(taskRepository, noteRepository);

  app.use(
    cors({
      origin: config.corsOrigins,
    }),
  );
  app.use(express.json());
  app.use(
    "/api",
    createApiRouter(
      noteService,
      aiSettingsService,
      aiExecutionService,
      taskService,
    ),
  );

  const staticIndexPath = config.frontendDistPath
    ? path.join(config.frontendDistPath, "index.html")
    : "";
  const hasStaticFrontend =
    Boolean(config.frontendDistPath) && fs.existsSync(staticIndexPath);

  if (hasStaticFrontend) {
    app.use(express.static(config.frontendDistPath));

    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) {
        next();
        return;
      }

      res.sendFile(staticIndexPath);
    });
  }

  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof HttpError) {
        res.status(error.status).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      console.error(error);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "unexpected error occurred",
        },
      });
    },
  );

  return app;
}
