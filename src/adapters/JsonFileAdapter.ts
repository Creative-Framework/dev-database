import * as fs from 'fs';
import * as path from 'path';
import { StorageAdapter } from './StorageAdapter';
import { ensureDirectoryExists } from '../utils';

export interface JsonFileAdapterOptions {
  filePath?: string;
  pretty?: boolean;
  autoCreate?: boolean;
}

export class JsonFileAdapter implements StorageAdapter {
  readonly name = 'json';

  private filePath: string = '';
  private pretty: boolean = true;
  private autoCreate: boolean = true;

  async init(options: Record<string, unknown>): Promise<void> {
    const opts = options as unknown as JsonFileAdapterOptions;
    this.filePath = path.resolve(opts.filePath ?? './database.json');  // .json not .db
    this.pretty = opts.pretty ?? true;
    this.autoCreate = opts.autoCreate ?? true;
  }

  async load(): Promise<Record<string, unknown>> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } else if (this.autoCreate) {
        ensureDirectoryExists(path.dirname(this.filePath));
        fs.writeFileSync(this.filePath, '{}', 'utf8');
      }
      return {};
    } catch {
      return {};
    }
  }

  async save(data: Record<string, unknown>): Promise<void> {
    const json = this.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    fs.writeFileSync(this.filePath, json, 'utf8');
  }

  async close(): Promise<void> {
    // no-op for file-based storage
  }

  async destroy(): Promise<void> {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }
}
