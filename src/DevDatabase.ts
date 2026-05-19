/**
 * DevDatabase - Core database class.
 * High-performance, typed JSON file-based database with events, dot notation,
 * collections, TTL, math/array ops, backup/restore.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from './EventEmitter';
import { Collection } from './Collection';
import {
  deepClone, getNestedValue, setNestedValue,
  deleteNestedValue, hasNestedValue, ensureDirectoryExists,
} from './utils';

/** Events emitted by DevDatabase. */
export type DatabaseEvents = {
  ready: [];
  set: [key: string, value: unknown, oldValue: unknown];
  delete: [key: string, value: unknown];
  clear: [];
  save: [];
  error: [error: Error];
  [key: string]: unknown[];
};

/** Configuration options for DevDatabase. */
export interface DatabaseOptions {
  /** Path to the JSON database file. */
  filePath?: string;
  /** Auto-save debounce time in ms (default: 300). */
  autoSaveInterval?: number;
  /** Pretty print JSON output (default: true). */
  pretty?: boolean;
  /** Auto-create file and directories (default: true). */
  autoCreate?: boolean;
  /** Separator for nested keys (default: '.'). */
  separator?: string;
}

/** Options for the set method. */
export interface SetOptions {
  /** Time-to-live in milliseconds. */
  ttl?: number;
}

/** Internal TTL metadata. */
interface TtlEntry {
  value: unknown;
  expiresAt: number;
}

export class DevDatabase extends EventEmitter<DatabaseEvents> {
  private filePath: string;
  private data: Record<string, unknown> = {};
  private ttlData: Map<string, TtlEntry> = new Map();
  private saveTimeout: NodeJS.Timeout | null = null;
  private isSaving = false;
  private isReady = false;
  private options: Required<DatabaseOptions>;
  private collections: Map<string, Collection> = new Map();

  constructor(filePathOrOptions?: string | DatabaseOptions) {
    super();

    const opts: DatabaseOptions =
      typeof filePathOrOptions === 'string'
        ? { filePath: filePathOrOptions }
        : filePathOrOptions ?? {};

    this.options = {
      filePath: opts.filePath ?? './database.json',
      autoSaveInterval: opts.autoSaveInterval ?? 300,
      pretty: opts.pretty ?? true,
      autoCreate: opts.autoCreate ?? true,
      separator: opts.separator ?? '.',
    };

    this.filePath = path.resolve(this.options.filePath);
    this._loadSync();
  }

  /** Synchronous load for constructor reliability. */
  private _loadSync(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          this.data = parsed;
        }
        // Restore TTL entries
        if (this.data.__ttl__ && typeof this.data.__ttl__ === 'object') {
          const ttlObj = this.data.__ttl__ as Record<string, TtlEntry>;
          const now = Date.now();
          for (const [key, entry] of Object.entries(ttlObj)) {
            if (entry.expiresAt > now) {
              this.ttlData.set(key, entry);
            } else {
              deleteNestedValue(this.data, key);
            }
          }
          delete this.data.__ttl__;
        }
      } else if (this.options.autoCreate) {
        ensureDirectoryExists(path.dirname(this.filePath));
        fs.writeFileSync(this.filePath, '{}', 'utf8');
      }
      this.isReady = true;
      this.emit('ready');
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Schedule a debounced save to disk. */
  private _scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this._save(), this.options.autoSaveInterval);
  }

  /** Save data to disk. */
  private _save(): void {
    if (this.isSaving) return;
    this.isSaving = true;

    try {
      const toSave = { ...this.data };

      // Save TTL metadata
      if (this.ttlData.size > 0) {
        const ttlObj: Record<string, TtlEntry> = {};
        const now = Date.now();
        for (const [key, entry] of this.ttlData) {
          if (entry.expiresAt > now) {
            ttlObj[key] = entry;
          }
        }
        if (Object.keys(ttlObj).length > 0) {
          toSave.__ttl__ = ttlObj;
        }
      }

      const json = this.options.pretty
        ? JSON.stringify(toSave, null, 2)
        : JSON.stringify(toSave);
      fs.writeFileSync(this.filePath, json, 'utf8');
      this.emit('save');
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isSaving = false;
    }
  }

  // ─── Core CRUD ───

  /**
   * Set a value by key. Supports dot notation for nested keys.
   * @param key - The key (supports dot notation like `'user.name'`).
   * @param value - The value to store.
   * @param options - Optional settings (e.g., TTL).
   * @returns `this` for chaining.
   */
  set(key: string, value: unknown, options?: SetOptions): this {
    const oldValue = this.get(key);

    if (key.includes(this.options.separator)) {
      setNestedValue(this.data, key, value);
    } else {
      this.data[key] = value;
    }

    // TTL
    if (options?.ttl && options.ttl > 0) {
      this.ttlData.set(key, { value, expiresAt: Date.now() + options.ttl });
    } else {
      this.ttlData.delete(key);
    }

    this.emit('set', key, value, oldValue);
    this._scheduleSave();
    return this;
  }

  /**
   * Get a value by key. Supports dot notation.
   * @param key - The key to retrieve.
   * @param defaultValue - Fallback value if key doesn't exist.
   * @returns The stored value or default.
   */
  get<T = unknown>(key: string, defaultValue?: T): T {
    // Check TTL
    if (this.ttlData.has(key)) {
      const entry = this.ttlData.get(key)!;
      if (Date.now() > entry.expiresAt) {
        this.delete(key);
        return defaultValue as T;
      }
    }

    let value: unknown;
    if (key.includes(this.options.separator)) {
      value = getNestedValue(this.data, key);
    } else {
      value = this.data[key];
    }

    return (value !== undefined ? value : defaultValue) as T;
  }

  /**
   * Check if a key exists.
   * @param key - The key to check (supports dot notation).
   */
  has(key: string): boolean {
    // Check TTL expiration
    if (this.ttlData.has(key)) {
      const entry = this.ttlData.get(key)!;
      if (Date.now() > entry.expiresAt) {
        this.delete(key);
        return false;
      }
    }

    if (key.includes(this.options.separator)) {
      return hasNestedValue(this.data, key);
    }
    return key in this.data;
  }

  /**
   * Delete a key. Supports dot notation.
   * @param key - The key to delete.
   * @returns `true` if the key existed and was deleted.
   */
  delete(key: string): boolean {
    const value = this.get(key);
    let deleted: boolean;

    if (key.includes(this.options.separator)) {
      deleted = deleteNestedValue(this.data, key);
    } else {
      deleted = key in this.data;
      if (deleted) delete this.data[key];
    }

    this.ttlData.delete(key);

    if (deleted) {
      this.emit('delete', key, value);
      this._scheduleSave();
    }

    return deleted;
  }

  /**
   * Clear all data from the database.
   * @returns `this` for chaining.
   */
  clear(): this {
    this.data = {};
    this.ttlData.clear();
    this.emit('clear');
    this._scheduleSave();
    return this;
  }

  // ─── Math Operations ───

  /**
   * Add a number to a stored value.
   * @param key - The key (creates it with 0 if doesn't exist).
   * @param amount - Amount to add (default: 1).
   */
  add(key: string, amount: number = 1): this {
    const current = this.get<number>(key, 0);
    return this.set(key, (typeof current === 'number' ? current : 0) + amount);
  }

  /**
   * Subtract a number from a stored value.
   * @param key - The key.
   * @param amount - Amount to subtract (default: 1).
   */
  subtract(key: string, amount: number = 1): this {
    return this.add(key, -amount);
  }

  /**
   * Multiply a stored value by a number.
   * @param key - The key.
   * @param factor - The multiplier.
   */
  multiply(key: string, factor: number): this {
    const current = this.get<number>(key, 0);
    return this.set(key, (typeof current === 'number' ? current : 0) * factor);
  }

  /**
   * Divide a stored value by a number.
   * @param key - The key.
   * @param divisor - The divisor (must not be 0).
   */
  divide(key: string, divisor: number): this {
    if (divisor === 0) throw new Error('Cannot divide by zero');
    const current = this.get<number>(key, 0);
    return this.set(key, (typeof current === 'number' ? current : 0) / divisor);
  }

  // ─── Array Operations ───

  /**
   * Push value(s) to an array stored at key.
   * Creates the array if it doesn't exist.
   * @param key - The key.
   * @param values - Value(s) to push.
   */
  push(key: string, ...values: unknown[]): this {
    const current = this.get<unknown[]>(key, []);
    const arr = Array.isArray(current) ? [...current] : [];
    arr.push(...values);
    return this.set(key, arr);
  }

  /**
   * Remove value(s) from an array stored at key.
   * @param key - The key.
   * @param values - Value(s) to remove.
   */
  pull(key: string, ...values: unknown[]): this {
    const current = this.get<unknown[]>(key, []);
    if (!Array.isArray(current)) return this;
    const filtered = current.filter((item) => !values.includes(item));
    return this.set(key, filtered);
  }

  /**
   * Check if an array at key includes a value.
   * @param key - The key.
   * @param value - The value to check for.
   */
  includes(key: string, value: unknown): boolean {
    const current = this.get<unknown[]>(key, []);
    return Array.isArray(current) && current.includes(value);
  }

  // ─── Bulk Operations ───

  /**
   * Set multiple key-value pairs at once.
   * @param entries - Array of `[key, value]` tuples or an object.
   */
  bulkSet(entries: [string, unknown][] | Record<string, unknown>): this {
    const pairs = Array.isArray(entries)
      ? entries
      : Object.entries(entries);

    for (const [key, value] of pairs) {
      this.set(key, value);
    }
    return this;
  }

  /**
   * Get multiple values by keys.
   * @param keys - Array of keys.
   * @returns Object with key-value pairs.
   */
  bulkGet(keys: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      result[key] = this.get(key);
    }
    return result;
  }

  /**
   * Delete multiple keys at once.
   * @param keys - Array of keys to delete.
   * @returns Number of keys deleted.
   */
  bulkDelete(keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      if (this.delete(key)) count++;
    }
    return count;
  }

  // ─── Collection System ───

  /**
   * Get or create a typed collection (MongoDB-like).
   * @param name - Collection name.
   * @returns A `Collection` instance.
   *
   * @example
   * ```ts
   * interface User { name: string; age: number }
   * const users = db.collection<User>('users');
   * users.insert({ name: 'Ameen', age: 20 });
   * ```
   */
  collection<T extends Record<string, unknown> = Record<string, unknown>>(
    name: string
  ): Collection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(
        name,
        new Collection<T>(name, {
          get: (key: string) => this.get(key),
          set: (key: string, value: unknown) => { this.set(key, value); },
        })
      );
    }
    return this.collections.get(name) as Collection<T>;
  }

  // ─── Backup & Restore ───

  /**
   * Create a backup of the database.
   * @param backupPath - Path to save the backup file.
   */
  async backup(backupPath: string): Promise<void> {
    const resolvedPath = path.resolve(backupPath);
    ensureDirectoryExists(path.dirname(resolvedPath));
    const json = JSON.stringify(this.data, null, 2);
    await fs.promises.writeFile(resolvedPath, json, 'utf8');
  }

  /**
   * Restore the database from a backup file.
   * @param backupPath - Path to the backup file.
   */
  async restore(backupPath: string): Promise<void> {
    const resolvedPath = path.resolve(backupPath);
    const raw = await fs.promises.readFile(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      this.data = parsed;
      this._scheduleSave();
    }
  }

  // ─── Utility Methods ───

  /**
   * Get all keys in the database.
   */
  keys(): string[] {
    return Object.keys(this.data);
  }

  /**
   * Get all values in the database.
   */
  values(): unknown[] {
    return Object.values(this.data);
  }

  /**
   * Get all key-value entries.
   */
  entries(): [string, unknown][] {
    return Object.entries(this.data);
  }

  /**
   * Get the total number of top-level keys.
   */
  get size(): number {
    return Object.keys(this.data).length;
  }

  /**
   * Iterate over all entries with a callback.
   * @param callback - Function called for each `(key, value)` pair.
   */
  forEach(callback: (key: string, value: unknown) => void): void {
    for (const [key, value] of Object.entries(this.data)) {
      callback(key, value);
    }
  }

  /**
   * Filter entries by a predicate function.
   * @param predicate - Function that returns `true` to include the entry.
   * @returns Object with matching entries.
   */
  filter(predicate: (key: string, value: unknown) => boolean): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.data)) {
      if (predicate(key, value)) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Map over all entries with a transform function.
   * @param transform - Function called for each `(key, value)` pair.
   * @returns Array of transformed values.
   */
  map<R>(transform: (key: string, value: unknown) => R): R[] {
    return Object.entries(this.data).map(([key, value]) => transform(key, value));
  }

  /**
   * Get a deep clone of all the raw data.
   */
  toJSON(): Record<string, unknown> {
    return deepClone(this.data);
  }

  /**
   * Whether the database is loaded and ready.
   */
  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Force save all data to disk immediately.
   */
  async save(): Promise<void> {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this._save();
  }

  /**
   * Save and close the database. Call this before shutting down.
   */
  async close(): Promise<void> {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this._save();
    this.removeAllListeners();
    this.collections.clear();
  }

  /**
   * Destroy the database — deletes the file from disk.
   */
  async destroy(): Promise<void> {
    await this.close();
    if (fs.existsSync(this.filePath)) {
      await fs.promises.unlink(this.filePath);
    }
  }
}
