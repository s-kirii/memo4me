import type { AppDatabase } from "../db/database";
import type { TagItem } from "../types";

export class TagRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): TagItem[] {
    return this.db
      .prepare(
        `
        SELECT DISTINCT tags.id, tags.name
        FROM tags
        WHERE EXISTS (
          SELECT 1 FROM note_tags WHERE note_tags.tag_id = tags.id
        )
        OR EXISTS (
          SELECT 1 FROM task_tags WHERE task_tags.tag_id = tags.id
        )
        ORDER BY name ASC
        `,
      )
      .all() as TagItem[];
  }
}
