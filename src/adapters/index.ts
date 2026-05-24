import { StorageAdapter } from './StorageAdapter';
import { JsonFileAdapter } from './JsonFileAdapter';
import { MysqlAdapter } from './MysqlAdapter';
import { SqliteAdapter } from './SqliteAdapter';

export { StorageAdapter } from './StorageAdapter';
export { JsonFileAdapter, JsonFileAdapterOptions } from './JsonFileAdapter';
export { MysqlAdapter, MysqlAdapterOptions } from './MysqlAdapter';
export { SqliteAdapter, SqliteAdapterOptions } from './SqliteAdapter';

export type DriverType = 'json' | 'mysql' | 'sqlite';

export function resolveAdapter(driver: DriverType): StorageAdapter {
  switch (driver) {
    case 'json':
      return new JsonFileAdapter();
    case 'mysql':
      return new MysqlAdapter();
    case 'sqlite':
      return new SqliteAdapter();
    default:
      throw new Error(
        `Unknown driver "${driver}". Supported drivers: json, mysql, sqlite`
      );
  }
}
