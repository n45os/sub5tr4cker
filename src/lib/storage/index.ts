import type { StorageAdapter } from "./adapter";
import { MongooseAdapter } from "./mongoose-adapter";

let _adapter: StorageAdapter | null = null;

/**
 * Returns the current storage adapter singleton.
 * In local mode this will return a SqliteAdapter; in advanced mode a MongooseAdapter.
 * The adapter is created lazily on first call.
 */
export function getAdapter(): StorageAdapter {
  if (_adapter) return _adapter;

  // check if local mode is configured by looking for the app-mode env var
  // set by the CLI / config manager when starting in local mode
  const mode = process.env.SUB5TR4CKER_MODE;

  if (mode === "local") {
    // SqliteAdapter is loaded lazily so it doesn't pull better-sqlite3 into
    // the bundle when running in advanced (MongoDB) mode
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SqliteAdapter } = require("./sqlite-adapter");
    const dataPath = process.env.SUB5TR4CKER_DATA_PATH ?? `${process.env.HOME}/.sub5tr4cker/data.db`;
    _adapter = new SqliteAdapter(dataPath);
  } else {
    _adapter = new MongooseAdapter();
  }

  return _adapter;
}

/**
 * Override the adapter instance.
 * Used in tests to inject a mock adapter, or during migration to
 * swap from SQLite to MongoDB mid-process.
 */
export function setAdapter(adapter: StorageAdapter): void {
  _adapter = adapter;
}

/**
 * Reset the adapter singleton.
 * Used in tests and in the migrate command before switching modes.
 */
export function resetAdapter(): void {
  _adapter = null;
}

export type { StorageAdapter } from "./adapter";
export * from "./types";
