import type { AppDatabase } from "../db/database";
import type { TaskItem, TaskStatus } from "../types";

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  source_note_id: string | null;
  source_note_title: string | null;
  source_selection_text: string | null;
  created_by: "manual" | "ai";
  created_at: string;
  updated_at: string;
};

export class TaskRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): TaskItem[] {
    const rows = this.db
      .prepare(
        `
        SELECT
          tasks.id,
          tasks.title,
          tasks.status,
          tasks.source_note_id,
          notes.title AS source_note_title,
          tasks.source_selection_text,
          tasks.created_by,
          tasks.created_at,
          tasks.updated_at
        FROM tasks
        LEFT JOIN notes ON notes.id = tasks.source_note_id
        ORDER BY
          CASE tasks.status WHEN 'open' THEN 0 ELSE 1 END ASC,
          tasks.updated_at DESC
        `,
      )
      .all() as TaskRow[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      sourceNoteId: row.source_note_id,
      sourceNoteTitle: row.source_note_title,
      sourceSelectionText: row.source_selection_text,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  findById(id: string): TaskItem | null {
    const row = this.db
      .prepare(
        `
        SELECT
          tasks.id,
          tasks.title,
          tasks.status,
          tasks.source_note_id,
          notes.title AS source_note_title,
          tasks.source_selection_text,
          tasks.created_by,
          tasks.created_at,
          tasks.updated_at
        FROM tasks
        LEFT JOIN notes ON notes.id = tasks.source_note_id
        WHERE tasks.id = ?
        LIMIT 1
        `,
      )
      .get(id) as TaskRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      sourceNoteId: row.source_note_id,
      sourceNoteTitle: row.source_note_title,
      sourceSelectionText: row.source_selection_text,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(input: {
    id: string;
    title: string;
    status: TaskStatus;
    sourceNoteId: string | null;
    sourceSelectionText: string | null;
    createdBy: "manual" | "ai";
    createdAt: string;
    updatedAt: string;
  }) {
    this.db
      .prepare(
        `
        INSERT INTO tasks (
          id,
          title,
          status,
          source_note_id,
          source_selection_text,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @title,
          @status,
          @sourceNoteId,
          @sourceSelectionText,
          @createdBy,
          @createdAt,
          @updatedAt
        )
        `,
      )
      .run(input);
  }

  update(input: {
    id: string;
    title: string;
    status: TaskStatus;
    updatedAt: string;
  }) {
    this.db
      .prepare(
        `
        UPDATE tasks
        SET title = @title,
            status = @status,
            updated_at = @updatedAt
        WHERE id = @id
        `,
      )
      .run(input);
  }

  delete(id: string) {
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  }
}
