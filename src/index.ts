export { DevDatabase } from './DevDatabase';
export { Collection } from './Collection';
export { EventEmitter } from './EventEmitter';

// Export adapters
export {
  StorageAdapter,
  JsonFileAdapter,
  MysqlAdapter,
  SqliteAdapter,
  resolveAdapter,
} from './adapters';

export type {
  JsonFileAdapterOptions,
  MysqlAdapterOptions,
  SqliteAdapterOptions,
  DriverType,
} from './adapters';

// Re-export types
export type {
  DatabaseOptions,
  DatabaseEvents,
  SetOptions,
} from './DevDatabase';

export type {
  Document,
  QueryOperators,
  QueryFilter,
  UpdateOperators,
  FindOptions,
} from './Collection';

// Default export
import { DevDatabase } from './DevDatabase';
export default DevDatabase;
