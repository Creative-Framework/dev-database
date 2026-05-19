/**
 * dev-database — A high-performance, typed JSON file-based database.
 *
 * @packageDocumentation
 * @module dev-database
 */

export { DevDatabase } from './DevDatabase';
export { Collection } from './Collection';
export { EventEmitter } from './EventEmitter';

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
