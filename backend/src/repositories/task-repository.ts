import type { AppDatabase } from "../db/database";
import type { TaskItem, TaskStatus } from "../types";

type TaskRow = {
  id: string;
  title: string;
  status: "open" | "done";
  workflow_stage: "open" | "in_progress";
  start_target_date: string | null;
  due_date: string | null;
  note_text: string | null;
  source_note_id: string | null;
  source_note_title: string | null;
  source_selection_text: string | null;
  created_by: "manual" | "ai";
  created_at: string;
  updated_at: string;
};

export class TaskRepository {
  constructor(private readonly db: AppDatabase) {}

  private toDatabaseStatus(status: TaskStatus) {
    return {
      dbStatus: status === "done" ? "done" : "open",
      workflowStage: status === "in_progress" ? "in_progress" : "open",
    } as const;
  }

  list(): TaskItem[] {
    const rows = this.db
      .prepare(
        `
        SELECT
          tasks.id,
          tasks.title,
          tasks.status,
          tasks.workflow_stage,
          tasks.start_target_date,
          tasks.due_date,
          tasks.note_text,
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
          CASE tasks.workflow_stage WHEN 'open' THEN 0 ELSE 1 END ASC,
          tasks.updated_at DESC
        `,
      )
      .all() as TaskRow[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status === "done" ? "done" : row.workflow_stage,
      tags: this.getTagNamesForTask(row.id),
      startTargetDate: row.start_target_date,
      dueDate: row.due_date,
      noteText: row.note_text,
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
          tasks.workflow_stage,
          tasks.start_target_date,
          tasks.due_date,
          tasks.note_text,
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
      status: row.status === "done" ? "done" : row.workflow_stage,
      tags: this.getTagNamesForTask(row.id),
      startTargetDate: row.start_target_date,
      dueDate: row.due_date,
      noteText: row.note_text,
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
    tags: { name: string; normalizedName: string }[];
    startTargetDate: string | null;
    dueDate: string | null;
    noteText: string | null;
    createdBy: "manual" | "ai";
    createdAt: string;
    updatedAt: string;
  }) {
    const taskStatus = this.toDatabaseStatus(input.status);

    this.db
      .prepare(
        `
        INSERT INTO tasks (
          id,
          title,
          status,
          workflow_stage,
          start_target_date,
          due_date,
          note_text,
          source_note_id,
          source_selection_text,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @title,
          @dbStatus,
          @workflowStage,
          @startTargetDate,
          @dueDate,
          @noteText,
          @sourceNoteId,
          @sourceSelectionText,
          @createdBy,
          @createdAt,
          @updatedAt
        )
        `,
      )
      .run({
        ...input,
        ...taskStatus,
      });

    this.upsertTagsForTask(input.id, input.tags);
  }

  update(input: {
    id: string;
    title: string;
    status: TaskStatus;
    tags: { name: string; normalizedName: string }[];
    startTargetDate: string | null;
    dueDate: string | null;
    noteText: string | null;
    sourceNoteId: string | null;
    updatedAt: string;
  }) {
    const taskStatus = this.toDatabaseStatus(input.status);

    this.db
      .prepare(
        `
        UPDATE tasks
        SET title = @title,
            status = @dbStatus,
            workflow_stage = @workflowStage,
            start_target_date = @startTargetDate,
            due_date = @dueDate,
            note_text = @noteText,
            source_note_id = @sourceNoteId,
            updated_at = @updatedAt
        WHERE id = @id
        `,
      )
      .run({
        ...input,
        ...taskStatus,
      });

    this.upsertTagsForTask(input.id, input.tags);
  }

  delete(id: string) {
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  }

  upsertTagsForTask(taskId: string, tags: { name: string; normalizedName: string }[]) {
    const insertTag = this.db.prepare(`
      INSERT INTO tags (id, name, normalized_name, created_at)
      VALUES (@id, @name, @normalizedName, @createdAt)
      ON CONFLICT(normalized_name) DO UPDATE SET name = excluded.name
    `);
    const getTagByNormalizedName = this.db.prepare(`
      SELECT id, name, normalized_name
      FROM tags
      WHERE normalized_name = ?
      LIMIT 1
    `);
    const deleteTaskTags = this.db.prepare("DELETE FROM task_tags WHERE task_id = ?");
    const insertTaskTag = this.db.prepare(`
      INSERT OR IGNORE INTO task_tags (task_id, tag_id)
      VALUES (?, ?)
    `);

    const transaction = this.db.transaction(() => {
      deleteTaskTags.run(taskId);

      for (const tag of tags) {
        insertTag.run({
          id: crypto.randomUUID(),
          name: tag.name,
          normalizedName: tag.normalizedName,
          createdAt: new Date().toISOString(),
        });

        const persistedTag = getTagByNormalizedName.get(tag.normalizedName) as
          | { id: string }
          | undefined;

        if (persistedTag) {
          insertTaskTag.run(taskId, persistedTag.id);
        }
      }
    });

    transaction();
  }

  private getTagNamesForTask(taskId: string) {
    return (
      this.db
        .prepare(
          `
          SELECT tags.name
          FROM task_tags
          INNER JOIN tags ON tags.id = task_tags.tag_id
          WHERE task_tags.task_id = ?
          ORDER BY tags.name ASC
          `,
        )
        .all(taskId) as Array<{ name: string }>
    ).map((row) => row.name);
  }
}
