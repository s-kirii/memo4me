import type { AppDatabase } from "../db/database";
import type { AiActionType, AiOutputItem, AiProviderId } from "../types";

type AiOutputRow = {
  id: string;
  note_id: string;
  provider: AiProviderId;
  action: AiActionType;
  model: string;
  content_md: string;
  created_at: string;
};

export class AiOutputRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: {
    id: string;
    noteId: string;
    provider: AiProviderId;
    action: AiActionType;
    model: string;
    contentMd: string;
    createdAt: string;
  }) {
    this.db
      .prepare(
        `
        INSERT INTO ai_outputs (
          id,
          note_id,
          provider,
          action,
          model,
          content_md,
          created_at
        )
        VALUES (
          @id,
          @noteId,
          @provider,
          @action,
          @model,
          @contentMd,
          @createdAt
        )
        `,
      )
      .run(input);
  }

  listByNoteId(noteId: string): AiOutputItem[] {
    const rows = this.db
      .prepare(
        `
        SELECT id, note_id, provider, action, model, content_md, created_at
        FROM ai_outputs
        WHERE note_id = ?
        ORDER BY created_at DESC
        `,
      )
      .all(noteId) as AiOutputRow[];

    return rows.map((row) => ({
      id: row.id,
      noteId: row.note_id,
      provider: row.provider,
      action: row.action,
      model: row.model,
      contentMd: row.content_md,
      createdAt: row.created_at,
    }));
  }
}
