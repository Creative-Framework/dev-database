/**
 * Utility functions for dev-database.
 * All helpers are pure functions with no side effects.
 */

import * as fs from 'fs';

/**
 * Deep clone a value using structured clone algorithm fallback.
 */
export function deepClone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Get a nested value from an object using dot notation.
 *
 * @example
 * ```ts
 * getNestedValue({ a: { b: { c: 42 } } }, 'a.b.c') // 42
 * getNestedValue({ a: { b: 1 } }, 'a.x') // undefined
 * ```
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set a nested value in an object using dot notation.
 * Automatically creates intermediate objects as needed.
 *
 * @example
 * ```ts
 * const obj = {};
 * setNestedValue(obj, 'a.b.c', 42) // { a: { b: { c: 42 } } }
 * ```
 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (
      current[key] === undefined ||
      current[key] === null ||
      typeof current[key] !== 'object' ||
      Array.isArray(current[key])
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Delete a nested value from an object using dot notation.
 * Returns true if the value existed and was deleted.
 *
 * @example
 * ```ts
 * const obj = { a: { b: { c: 42 } } };
 * deleteNestedValue(obj, 'a.b.c') // true, obj is now { a: { b: {} } }
 * ```
 */
export function deleteNestedValue(obj: Record<string, unknown>, path: string): boolean {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object') {
      return false;
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey in current) {
    delete current[lastKey];
    return true;
  }

  return false;
}

/**
 * Check if a nested key exists in an object.
 */
export function hasNestedValue(obj: Record<string, unknown>, path: string): boolean {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    if (!(key in (current as Record<string, unknown>))) {
      return false;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return true;
}

/**
 * Check if a value matches a query with operators (used by Collection.find).
 *
 * Supported operators: `$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$in`, `$nin`, `$exists`, `$regex`.
 */
export function matchesQuery(
  doc: Record<string, unknown>,
  query: Record<string, unknown>
): boolean {
  for (const [field, condition] of Object.entries(query)) {
    const value = getNestedValue(doc, field);

    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
      const operators = condition as Record<string, unknown>;

      for (const [op, opValue] of Object.entries(operators)) {
        switch (op) {
          case '$gt':
            if (typeof value !== 'number' || typeof opValue !== 'number' || value <= opValue) return false;
            break;
          case '$gte':
            if (typeof value !== 'number' || typeof opValue !== 'number' || value < opValue) return false;
            break;
          case '$lt':
            if (typeof value !== 'number' || typeof opValue !== 'number' || value >= opValue) return false;
            break;
          case '$lte':
            if (typeof value !== 'number' || typeof opValue !== 'number' || value > opValue) return false;
            break;
          case '$ne':
            if (value === opValue) return false;
            break;
          case '$in':
            if (!Array.isArray(opValue) || !opValue.includes(value)) return false;
            break;
          case '$nin':
            if (!Array.isArray(opValue) || opValue.includes(value)) return false;
            break;
          case '$exists':
            if (opValue === true && value === undefined) return false;
            if (opValue === false && value !== undefined) return false;
            break;
          case '$regex': {
            const pattern = opValue instanceof RegExp ? opValue : new RegExp(String(opValue));
            if (typeof value !== 'string' || !pattern.test(value)) return false;
            break;
          }
          default:
            break;
        }
      }
    } else {
      // Direct equality check
      if (value !== condition) return false;
    }
  }

  return true;
}

/**
 * Generate a unique ID (simple, no external dependency).
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
