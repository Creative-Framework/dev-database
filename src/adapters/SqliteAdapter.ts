import { StorageAdapter } from './StorageAdapter';

export interface SqliteAdapterOptions {
  filePath?: string;
  tableName?: string;
}

let Database: any = null;

function loadDriver(): void {
  if (Database) return;
  try {
    Database = require('better-sqlite3');
  } catch {
    throw new Error(
      'SQLite driver not found. Install it with: npm install better-sqlite3'
    );
  }
}

export class SqliteAdapter implements StorageAdapter {
  readonly name = 'sqlite';

  private db: any = null;
  private tableName: string = 'dev_database';

  async init(options: Record<string, unknown>): Promise<void> {
    loadDriver();
    const opts = options as unknown as SqliteAdapterOptions;
    this.tableName = opts.tableName ?? 'dev_database';

    this.db = new Database(opts.filePath ?? './database.sqlite');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${this.tableName}" (
        "key" TEXT PRIMARY KEY,
        "value" TEXT NOT NULL
      )
    `);
  }

  async load(): Promise<Record<string, unknown>> {
    try {
      const rows = this.db
        .prepare(`SELECT "key", "value" FROM "${this.tableName}"`)
        .all() as Array<{ key: string; value: string }>;

      const data: Record<string, unknown> = {};
      for (const row of rows) {
        try {
          data[row.key] = JSON.parse(row.value);
        } catch {
          data[row.key] = row.value;
        }
      }
      return data;
    } catch {
      return {};
    }
  }

  async save(data: Record<string, unknown>): Promise<void> {
    const entries = Object.entries(data);

    const transaction = this.db.transaction(() => {
      this.db.exec(`DELETE FROM "${this.tableName}"`);

      const insert = this.db.prepare(
        `INSERT INTO "${this.tableName}" ("key", "value") VALUES (?, ?)`
      );

      for (const [key, value] of entries) {
        insert.run(key, JSON.stringify(value));
      }
    });

    transaction();
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async destroy(): Promise<void> {
    try {
      this.db.exec(`DROP TABLE IF EXISTS "${this.tableName}"`);
    } catch {
      // ignore
    }
  }
}
