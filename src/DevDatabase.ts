import { EventEmitter } from './EventEmitter';
import { Collection } from './Collection';
import * as fs from 'fs';
import * as path from 'path';
import {
  deepClone, getNestedValue, setNestedValue,
  deleteNestedValue, hasNestedValue, ensureDirectoryExists,
} from './utils';
import {
  StorageAdapter,
  DriverType,
  resolveAdapter,
  JsonFileAdapter,
} from './adapters';

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
  /** Storage driver (default: 'json'). */
  driver?: DriverType;
  /** Path to the database file (for json/sqlite drivers). */
  filePath?: string;
  /** Auto-save debounce time in ms (default: 300). */
  autoSaveInterval?: number;
  /** Pretty print JSON output (default: true, json driver only). */
  pretty?: boolean;
  /** Auto-create file and directories (default: true, json driver only). */
  autoCreate?: boolean;
  /** Separator for nested keys (default: '.'). */
  separator?: string;
  /** Custom adapter instance (overrides `driver`). */
  adapter?: StorageAdapter;

  // MySQL-specific options
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;

  // Table name for mysql/sqlite
  tableName?: string;
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
  private adapter: StorageAdapter;
  private data: Record<string, unknown> = {};
  private ttlData: Map<string, TtlEntry> = new Map();
  private saveTimeout: NodeJS.Timeout | null = null;
  private isSaving = false;
  private isReady = false;
  private options: {
    filePath: string;
    autoSaveInterval: number;
    pretty: boolean;
    autoCreate: boolean;
    separator: string;
    driver: string;
    tableName: string;
  };
  private collections: Map<string, Collection> = new Map();

  constructor(options?: DatabaseOptions | string) {
    super();

    const opts: DatabaseOptions =
      typeof options === 'string'
        ? { filePath: options, driver: 'json' }
        : options ?? {};

    this.options = {
      filePath: opts.filePath ?? './database.json',
      autoSaveInterval: opts.autoSaveInterval ?? 300,
      pretty: opts.pretty ?? true,
      autoCreate: opts.autoCreate ?? true,
      separator: opts.separator ?? '.',
      driver: opts.driver ?? 'json',
      tableName: opts.tableName ?? 'dev_database',
    };

    this.adapter = opts.adapter ?? resolveAdapter(opts.driver ?? 'json');

    // JSON adapter: auto-init synchronously (backward compatible)
    // SQL adapters: user must call await db.init()
    if (this.adapter instanceof JsonFileAdapter) {
      this._initSync();
    }
  }

  /**
   * Initialize the database (connect to storage, load data).
   * Required for non-JSON drivers (mysql, sqlite).
   * Safe to call multiple times.
   */
  async init(): Promise<void> {
    if (this.isReady) return;

    await this.adapter.init(this._getAdapterOptions());

    try {
      const loaded = await this.adapter.load();
      if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
        this.data = loaded;
      }
    } catch {
      this.data = {};
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

    this.isReady = true;
    this.emit('ready');
  }

  /** JSON adapter: sync init for backward compatibility. */
  private _initSync(): void {
    try {
      this.adapter.init(this._getAdapterOptions());
      const loaded = this.adapter.load() as unknown as Record<string, unknown>;
      if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
        this.data = loaded;
      }
    } catch {
      this.data = {};
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

    this.isReady = true;
    this.emit('ready');
  }

  /** Build adapter options from current config. */
  private _getAdapterOptions(): Record<string, unknown> {
    return {
      filePath: this.options.filePath,
      pretty: this.options.pretty,
      autoCreate: this.options.autoCreate,
      tableName: this.options.tableName,
    };
  }

  /** Schedule a debounced save to storage. */
  private _scheduleSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this._save(), this.options.autoSaveInterval);
  }

  /** Persist data to storage via adapter. */
  private async _save(): Promise<void> {
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

      await this.adapter.save(toSave);
      this.emit('save');
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isSaving = false;
    }
  }

  // ─── Core CRUD ───

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

  clear(): this {
    this.data = {};
    this.ttlData.clear();
    this.emit('clear');
    this._scheduleSave();
    return this;
  }

  // ─── Math Operations ───

  add(key: string, amount: number = 1): this {
    const current = this.get<number>(key, 0);
    return this.set(key, (typeof current === 'number' ? current : 0) + amount);
  }

  subtract(key: string, amount: number = 1): this {
    return this.add(key, -amount);
  }

  multiply(key: string, factor: number): this {
    const current = this.get<number>(key, 0);
    return this.set(key, (typeof current === 'number' ? current : 0) * factor);
  }

  divide(key: string, divisor: number): this {
    if (divisor === 0) throw new Error('Cannot divide by zero');
    const current = this.get<number>(key, 0);
    return this.set(key, (typeof current === 'number' ? current : 0) / divisor);
  }

  // ─── Array Operations ───

  push(key: string, ...values: unknown[]): this {
    const current = this.get<unknown[]>(key, []);
    const arr = Array.isArray(current) ? [...current] : [];
    arr.push(...values);
    return this.set(key, arr);
  }

  pull(key: string, ...values: unknown[]): this {
    const current = this.get<unknown[]>(key, []);
    if (!Array.isArray(current)) return this;
    const filtered = current.filter((item) => !values.includes(item));
    return this.set(key, filtered);
  }

  includes(key: string, value: unknown): boolean {
    const current = this.get<unknown[]>(key, []);
    return Array.isArray(current) && current.includes(value);
  }

  // ─── Bulk Operations ───

  bulkSet(entries: [string, unknown][] | Record<string, unknown>): this {
    const pairs = Array.isArray(entries)
      ? entries
      : Object.entries(entries);

    for (const [key, value] of pairs) {
      this.set(key, value);
    }
    return this;
  }

  bulkGet(keys: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      result[key] = this.get(key);
    }
    return result;
  }

  bulkDelete(keys: string[]): number {
    let count = 0;
    for (const key of keys) {
      if (this.delete(key)) count++;
    }
    return count;
  }

  // ─── Collection System ───

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

  async backup(backupPath: string): Promise<void> {
    const json = JSON.stringify(this.data, null, 2);
    const resolvedPath = path.resolve(backupPath);
    ensureDirectoryExists(path.dirname(resolvedPath));
    await fs.promises.writeFile(resolvedPath, json, 'utf8');
  }

  async restore(backupPath: string): Promise<void> {
    const raw = await fs.promises.readFile(backupPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      this.data = parsed;
      this._scheduleSave();
    }
  }

  // ─── Utility Methods ───

  keys(): string[] {
    return Object.keys(this.data);
  }

  values(): unknown[] {
    return Object.values(this.data);
  }

  entries(): [string, unknown][] {
    return Object.entries(this.data);
  }

  get size(): number {
    return Object.keys(this.data).length;
  }

  forEach(callback: (key: string, value: unknown) => void): void {
    for (const [key, value] of Object.entries(this.data)) {
      callback(key, value);
    }
  }

  filter(predicate: (key: string, value: unknown) => boolean): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(this.data)) {
      if (predicate(key, value)) {
        result[key] = value;
      }
    }
    return result;
  }

  map<R>(transform: (key: string, value: unknown) => R): R[] {
    return Object.entries(this.data).map(([key, value]) => transform(key, value));
  }

  toJSON(): Record<string, unknown> {
    return deepClone(this.data);
  }

  get ready(): boolean {
    return this.isReady;
  }

  /**
   * Force save all data to storage immediately.
   */
  async save(): Promise<void> {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    await this._save();
  }

  /**
   * Close the database — save and disconnect from storage.
   * Call this before shutting down.
   */
  async close(): Promise<void> {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    await this._save();
    await this.adapter.close();
    this.removeAllListeners();
    this.collections.clear();
  }

  /**
   * Destroy the database — delete all stored data.
   */
  async destroy(): Promise<void> {
    await this.close();
    await this.adapter.destroy();
  }
}
