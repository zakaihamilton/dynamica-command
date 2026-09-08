import { SAVE_CONTENT_VERSION } from "./validation";

export type SaveMigration = (state: unknown) => unknown;

/**
 * Content migrations are keyed by the version they upgrade from. The current
 * format is already version 1, so this registry is intentionally empty until
 * a future schema change requires a new version.
 */
export const SAVE_CONTENT_MIGRATIONS: Readonly<Record<number, SaveMigration>> = {};

export function migrateSaveContent(state: unknown, contentVersion: unknown): unknown {
  if (typeof contentVersion !== "number" || !Number.isInteger(contentVersion)
    || contentVersion < 1 || contentVersion > SAVE_CONTENT_VERSION) {
    throw new Error("Unsupported save content version");
  }

  let migrated = state;
  for (let version = contentVersion; version < SAVE_CONTENT_VERSION; version += 1) {
    const migration = SAVE_CONTENT_MIGRATIONS[version];
    if (!migration) throw new Error(`Missing save migration from content version ${version}`);
    migrated = migration(migrated);
  }
  return migrated;
}
