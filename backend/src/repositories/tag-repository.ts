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
        INNER JOIN note_tags ON note_tags.tag_id = tags.id
        ORDER BY name ASC
        `,
      )
      .all() as TagItem[];
  }
}
