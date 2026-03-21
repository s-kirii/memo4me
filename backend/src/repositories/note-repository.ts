import type { AppDatabase } from "../db/database";
import { createExcerpt } from "../utils/content";
import type { ListNotesParams, NoteDetail, NoteInput, NoteListItem } from "../types";

type NoteRow = {
  id: string;
  title: string;
  content_md: string;
  content_plain: string;
  created_at: string;
  updated_at: string;
};

type TagRow = {
  id: string;
  name: string;
  normalized_name: string;
};

export class NoteRepository {
  constructor(private readonly db: AppDatabase) {}

  list(params: ListNotesParams): NoteListItem[] {
    const sortClause = this.getSortClause(params.sort);
    const where: string[] = ["notes.is_archived = 0"];
    const values: unknown[] = [];

    if (params.q) {
      const pattern = `%${params.q.trim().toLowerCase()}%`;
      where.push(`(
        lower(notes.title) LIKE ?
        OR lower(notes.content_plain) LIKE ?
        OR EXISTS (
          SELECT 1
          FROM note_tags qnt
          INNER JOIN tags qt ON qt.id = qnt.tag_id
          WHERE qnt.note_id = notes.id
            AND lower(qt.name) LIKE ?
        )
      )`);
      values.push(pattern, pattern, pattern);
    }

    if (params.tag) {
      where.push(`EXISTS (
        SELECT 1
        FROM note_tags tnt
        INNER JOIN tags tt ON tt.id = tnt.tag_id
        WHERE tnt.note_id = notes.id
          AND tt.normalized_name = ?
      )`);
      values.push(params.tag.trim().toLowerCase());
    }

    const rows = this.db
      .prepare(
        `
        SELECT notes.id, notes.title, notes.content_md, notes.content_plain, notes.created_at, notes.updated_at
        FROM notes
        WHERE ${where.join(" AND ")}
        ORDER BY ${sortClause}
        `,
      )
      .all(...values) as NoteRow[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      excerpt: createExcerpt(row.content_plain),
      tags: this.getTagNamesForNote(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  findById(id: string): NoteDetail | null {
    const row = this.db
      .prepare(
        `
        SELECT id, title, content_md, content_plain, created_at, updated_at
        FROM notes
        WHERE id = ?
        LIMIT 1
        `,
      )
      .get(id) as NoteRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      contentMd: row.content_md,
      tags: this.getTagNamesForNote(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  create(note: {
    id: string;
    title: string;
    contentMd: string;
    contentPlain: string;
    createdAt: string;
    updatedAt: string;
  }) {
    this.db
      .prepare(
        `
        INSERT INTO notes (id, title, content_md, content_plain, created_at, updated_at)
        VALUES (@id, @title, @contentMd, @contentPlain, @createdAt, @updatedAt)
        `,
      )
      .run(note);
  }

  update(note: {
    id: string;
    title: string;
    contentMd: string;
    contentPlain: string;
    updatedAt: string;
  }) {
    this.db
      .prepare(
        `
        UPDATE notes
        SET title = @title,
            content_md = @contentMd,
            content_plain = @contentPlain,
            updated_at = @updatedAt
        WHERE id = @id
        `,
      )
      .run(note);
  }

  delete(id: string) {
    this.db.prepare("DELETE FROM notes WHERE id = ?").run(id);
  }

  noteExists(id: string) {
    const row = this.db
      .prepare("SELECT 1 as found FROM notes WHERE id = ? LIMIT 1")
      .get(id) as { found: number } | undefined;
    return Boolean(row);
  }

  getTagNamesForNote(noteId: string) {
    return (
      this.db
        .prepare(
          `
          SELECT tags.name
          FROM note_tags
          INNER JOIN tags ON tags.id = note_tags.tag_id
          WHERE note_tags.note_id = ?
          ORDER BY tags.name ASC
          `,
        )
        .all(noteId) as Array<{ name: string }>
    ).map((row) => row.name);
  }

  upsertTagsForNote(noteId: string, tags: { name: string; normalizedName: string }[]) {
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
    const deleteNoteTags = this.db.prepare("DELETE FROM note_tags WHERE note_id = ?");
    const insertNoteTag = this.db.prepare(`
      INSERT OR IGNORE INTO note_tags (note_id, tag_id)
      VALUES (?, ?)
    `);

    const transaction = this.db.transaction(() => {
      deleteNoteTags.run(noteId);

      for (const tag of tags) {
        insertTag.run({
          id: crypto.randomUUID(),
          name: tag.name,
          normalizedName: tag.normalizedName,
          createdAt: new Date().toISOString(),
        });

        const persistedTag = getTagByNormalizedName.get(tag.normalizedName) as
          | TagRow
          | undefined;

        if (persistedTag) {
          insertNoteTag.run(noteId, persistedTag.id);
        }
      }
    });

    transaction();
  }

  private getSortClause(sort?: string) {
    switch (sort) {
      case "updated_asc":
        return "notes.updated_at ASC";
      case "created_desc":
        return "notes.created_at DESC";
      case "title_asc":
        return "notes.title ASC";
      case "updated_desc":
      default:
        return "notes.updated_at DESC";
    }
  }
}
