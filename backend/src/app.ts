import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import type { AppDatabase } from "./db/database";
import { config } from "./config";
import { NoteRepository } from "./repositories/note-repository";
import { TagRepository } from "./repositories/tag-repository";
import { NoteService } from "./services/note-service";
import { createApiRouter } from "./routes/api";
import { HttpError } from "./utils/http-error";

export function createApp(db: AppDatabase) {
  const app = express();
  const noteRepository = new NoteRepository(db);
  const tagRepository = new TagRepository(db);
  const noteService = new NoteService(noteRepository, tagRepository);

  app.use(
    cors({
      origin: config.corsOrigins,
    }),
  );
  app.use(express.json());
  app.use("/api", createApiRouter(noteService));

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
