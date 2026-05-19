/**
 * Collection - A MongoDB-like collection system for dev-database.
 *
 * Provides document-based storage with insert, find, update, and delete
 * operations using a query syntax similar to MongoDB.
 *
 * @example
 * ```ts
 * const users = db.collection<{ name: string; age: number }>('users');
 *
 * users.insert({ name: 'Ameen', age: 20 });
 * users.find({ age: { $gt: 18 } });
 * users.findOne({ name: 'Ameen' });
 * users.update({ name: 'Ameen' }, { age: 21 });
 * users.delete({ name: 'Ameen' });
 * ```
 */

import { matchesQuery, generateId, deepClone } from './utils';

/** A document stored in a collection, always has a unique `_id`. */
export interface Document {
  _id: string;
  [key: string]: unknown;
}

/** Query operators for filtering documents. */
export interface QueryOperators {
  $gt?: number;
  $gte?: number;
  $lt?: number;
  $lte?: number;
  $ne?: unknown;
  $in?: unknown[];
  $nin?: unknown[];
  $exists?: boolean;
  $regex?: string | RegExp;
}

/** A query filter — each field can be a direct value or an operator object. */
export type QueryFilter<T = Record<string, unknown>> = {
  [K in keyof T]?: T[K] | QueryOperators;
} & Record<string, unknown>;

/** Update operators for modifying documents. */
export interface UpdateOperators {
  $set?: Record<string, unknown>;
  $inc?: Record<string, number>;
  $unset?: Record<string, boolean>;
  $push?: Record<string, unknown>;
  $pull?: Record<string, unknown>;
}

/** Options for find operations. */
export interface FindOptions {
  /** Maximum number of documents to return. */
  limit?: number;
  /** Number of documents to skip. */
  skip?: number;
  /** Sort order: 1 for ascending, -1 for descending. */
  sort?: Record<string, 1 | -1>;
}

/** Reference to the parent database's get/set methods. */
export interface CollectionStorage {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

export class Collection<T extends Record<string, unknown> = Record<string, unknown>> {
  private name: string;
  private storage: CollectionStorage;

  constructor(name: string, storage: CollectionStorage) {
    this.name = name;
    this.storage = storage;
  }

  /** Get the storage key for this collection. */
  private get storageKey(): string {
    return `__collections__.${this.name}`;
  }

  /** Get all documents in this collection. */
  private getDocs(): (T & Document)[] {
    const data = this.storage.get(this.storageKey);
    return Array.isArray(data) ? data as (T & Document)[] : [];
  }

  /** Save all documents back to the database. */
  private saveDocs(docs: (T & Document)[]): void {
    this.storage.set(this.storageKey, docs);
  }

  /**
   * Insert a single document into the collection.
   * Automatically generates a unique `_id` if not provided.
   *
   * @param doc - The document to insert.
   * @returns The inserted document with `_id`.
   */
  insert(doc: T): T & Document {
    const docs = this.getDocs();
    const newDoc: T & Document = {
      _id: generateId(),
      ...deepClone(doc),
    };
    docs.push(newDoc);
    this.saveDocs(docs);
    return deepClone(newDoc);
  }

  /**
   * Insert multiple documents into the collection.
   *
   * @param items - Array of documents to insert.
   * @returns Array of inserted documents with `_id`.
   */
  insertMany(items: T[]): (T & Document)[] {
    const docs = this.getDocs();
    const inserted: (T & Document)[] = [];

    for (const item of items) {
      const newDoc: T & Document = {
        _id: generateId(),
        ...deepClone(item),
      };
      docs.push(newDoc);
      inserted.push(deepClone(newDoc));
    }

    this.saveDocs(docs);
    return inserted;
  }

  /**
   * Find all documents matching a query.
   *
   * @param query - Query filter (supports MongoDB-like operators).
   * @param options - Optional find options (limit, skip, sort).
   * @returns Array of matching documents.
   *
   * @example
   * ```ts
   * // Find all users older than 18
   * users.find({ age: { $gt: 18 } });
   *
   * // Find with sorting and limiting
   * users.find({}, { sort: { age: -1 }, limit: 10 });
   * ```
   */
  find(query: QueryFilter<T> = {}, options: FindOptions = {}): (T & Document)[] {
    let results = this.getDocs().filter((doc) =>
      matchesQuery(doc as Record<string, unknown>, query as Record<string, unknown>)
    );

    // Sort
    if (options.sort) {
      const sortEntries = Object.entries(options.sort);
      results.sort((a, b) => {
        for (const [field, order] of sortEntries) {
          const aVal = (a as Record<string, unknown>)[field];
          const bVal = (b as Record<string, unknown>)[field];

          if (aVal === bVal) continue;
          if (aVal === undefined || aVal === null) return order;
          if (bVal === undefined || bVal === null) return -order;

          if ((aVal as number) < (bVal as number)) return -1 * order;
          if ((aVal as number) > (bVal as number)) return 1 * order;
        }
        return 0;
      });
    }

    // Skip
    if (options.skip && options.skip > 0) {
      results = results.slice(options.skip);
    }

    // Limit
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results.map((doc) => deepClone(doc));
  }

  /**
   * Find the first document matching a query.
   *
   * @param query - Query filter.
   * @returns The first matching document, or `null` if not found.
   */
  findOne(query: QueryFilter<T> = {}): (T & Document) | null {
    const doc = this.getDocs().find((d) =>
      matchesQuery(d as Record<string, unknown>, query as Record<string, unknown>)
    );
    return doc ? deepClone(doc) : null;
  }

  /**
   * Find a document by its `_id`.
   *
   * @param id - The document ID.
   * @returns The matching document, or `null` if not found.
   */
  findById(id: string): (T & Document) | null {
    const doc = this.getDocs().find((d) => d._id === id);
    return doc ? deepClone(doc) : null;
  }

  /**
   * Update all documents matching a query.
   *
   * @param query - Query filter to find documents to update.
   * @param update - Object with fields to update, or update operators.
   * @returns Number of updated documents.
   *
   * @example
   * ```ts
   * // Direct field update
   * users.update({ name: 'Ameen' }, { age: 21 });
   *
   * // Using operators
   * users.update({ name: 'Ameen' }, { $inc: { age: 1 }, $set: { active: true } });
   * ```
   */
  update(query: QueryFilter<T>, update: Partial<T> | UpdateOperators): number {
    const docs = this.getDocs();
    let count = 0;

    for (const doc of docs) {
      if (!matchesQuery(doc as Record<string, unknown>, query as Record<string, unknown>)) {
        continue;
      }

      count++;
      const hasOperators = Object.keys(update).some((k) => k.startsWith('$'));

      if (hasOperators) {
        const ops = update as UpdateOperators;

        if (ops.$set) {
          Object.assign(doc, ops.$set);
        }

        if (ops.$inc) {
          for (const [field, amount] of Object.entries(ops.$inc)) {
            const current = (doc as Record<string, unknown>)[field];
            (doc as Record<string, unknown>)[field] =
              (typeof current === 'number' ? current : 0) + amount;
          }
        }

        if (ops.$unset) {
          for (const field of Object.keys(ops.$unset)) {
            delete (doc as Record<string, unknown>)[field];
          }
        }

        if (ops.$push) {
          for (const [field, value] of Object.entries(ops.$push)) {
            const arr = (doc as Record<string, unknown>)[field];
            if (Array.isArray(arr)) {
              arr.push(value);
            } else {
              (doc as Record<string, unknown>)[field] = [value];
            }
          }
        }

        if (ops.$pull) {
          for (const [field, value] of Object.entries(ops.$pull)) {
            const arr = (doc as Record<string, unknown>)[field];
            if (Array.isArray(arr)) {
              (doc as Record<string, unknown>)[field] = arr.filter(
                (item) => item !== value
              );
            }
          }
        }
      } else {
        // Direct field update (merge)
        Object.assign(doc, update);
      }
    }

    if (count > 0) {
      this.saveDocs(docs);
    }

    return count;
  }

  /**
   * Update a single document by ID.
   *
   * @param id - The document ID.
   * @param update - Object with fields to update, or update operators.
   * @returns `true` if the document was found and updated.
   */
  updateById(id: string, update: Partial<T> | UpdateOperators): boolean {
    return this.update({ _id: id } as QueryFilter<T>, update) > 0;
  }

  /**
   * Delete all documents matching a query.
   *
   * @param query - Query filter to find documents to delete.
   * @returns Number of deleted documents.
   */
  delete(query: QueryFilter<T>): number {
    const docs = this.getDocs();
    const before = docs.length;
    const remaining = docs.filter(
      (doc) =>
        !matchesQuery(doc as Record<string, unknown>, query as Record<string, unknown>)
    );
    const count = before - remaining.length;

    if (count > 0) {
      this.saveDocs(remaining);
    }

    return count;
  }

  /**
   * Delete a single document by ID.
   *
   * @param id - The document ID.
   * @returns `true` if the document was found and deleted.
   */
  deleteById(id: string): boolean {
    return this.delete({ _id: id } as QueryFilter<T>) > 0;
  }

  /**
   * Count documents matching a query.
   *
   * @param query - Query filter (default: all documents).
   * @returns The number of matching documents.
   */
  count(query: QueryFilter<T> = {}): number {
    return this.getDocs().filter((doc) =>
      matchesQuery(doc as Record<string, unknown>, query as Record<string, unknown>)
    ).length;
  }

  /**
   * Remove all documents from this collection.
   */
  drop(): void {
    this.saveDocs([]);
  }

  /**
   * Get all documents in this collection.
   *
   * @returns Array of all documents.
   */
  all(): (T & Document)[] {
    return this.getDocs().map((doc) => deepClone(doc));
  }
}
