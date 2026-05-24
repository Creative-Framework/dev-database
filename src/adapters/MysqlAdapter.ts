import { StorageAdapter } from './StorageAdapter';

export interface MysqlAdapterOptions {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  tableName?: string;
}

let mysql2: any = null;

function loadDriver(): void {
  if (mysql2) return;
  try {
    mysql2 = require('mysql2/promise');
  } catch {
    throw new Error(
      'MySQL driver not found. Install it with: npm install mysql2'
    );
  }
}

export class MysqlAdapter implements StorageAdapter {
  readonly name = 'mysql';

  private connection: any = null;
  private tableName: string = 'dev_database';
  private options: MysqlAdapterOptions = {};

  async init(options: Record<string, unknown>): Promise<void> {
    loadDriver();
    this.options = options as unknown as MysqlAdapterOptions;
    this.tableName = this.options.tableName ?? 'dev_database';

    this.connection = await mysql2.createConnection({
      host: this.options.host ?? 'localhost',
      port: this.options.port ?? 3306,
      user: this.options.user ?? 'root',
      password: this.options.password ?? '',
      database: this.options.database ?? 'dev_database',
    });

    await this.connection.execute(`
      CREATE TABLE IF NOT EXISTS \`${this.tableName}\` (
        \`key\` VARCHAR(255) PRIMARY KEY,
        \`value\` LONGTEXT NOT NULL
      )
    `);
  }

  async load(): Promise<Record<string, unknown>> {
    try {
      const [rows] = await this.connection.execute(
        `SELECT \`key\`, \`value\` FROM \`${this.tableName}\``
      );
      const data: Record<string, unknown> = {};
      for (const row of rows as Array<{ key: string; value: string }>) {
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
    await this.connection.execute(`TRUNCATE TABLE \`${this.tableName}\``);

    if (entries.length === 0) return;

    const placeholders = entries.map(() => '(?, ?)').join(', ');
    const values: any[] = [];
    for (const [key, value] of entries) {
      values.push(key, JSON.stringify(value));
    }

    await this.connection.execute(
      `INSERT INTO \`${this.tableName}\` (\`key\`, \`value\`) VALUES ${placeholders}`,
      values
    );
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async destroy(): Promise<void> {
    try {
      await this.connection.execute(`DROP TABLE IF EXISTS \`${this.tableName}\``);
    } catch {
      // ignore
    }
  }
}
