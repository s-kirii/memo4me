import type { AppDatabase } from "../db/database";
import type { TagItem } from "../types";

export class TagRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): TagItem[] {
    return this.db
      .prepare(
        `
        SELECT id, name
        FROM tags
        ORDER BY name ASC
        `,
      )
      .all() as TagItem[];
  }
}
