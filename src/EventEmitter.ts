/**
 * Custom lightweight EventEmitter for dev-database.
 * Provides typed event support without external dependencies.
 */

export type Listener<T extends unknown[] = unknown[]> = (...args: T) => void;

export class EventEmitter<Events extends Record<string, unknown[]> = Record<string, unknown[]>> {
  private _listeners: Map<keyof Events, Set<Listener>> = new Map();
  private _onceListeners: Map<keyof Events, Set<Listener>> = new Map();

  /**
   * Register an event listener.
   * @param event - The event name to listen for.
   * @param listener - The callback function.
   * @returns `this` for chaining.
   */
  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener as Listener);
    return this;
  }

  /**
   * Register a one-time event listener (fires once then auto-removes).
   * @param event - The event name to listen for.
   * @param listener - The callback function.
   * @returns `this` for chaining.
   */
  once<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    if (!this._onceListeners.has(event)) {
      this._onceListeners.set(event, new Set());
    }
    this._onceListeners.get(event)!.add(listener as Listener);
    return this;
  }

  /**
   * Remove an event listener.
   * @param event - The event name.
   * @param listener - The callback to remove.
   * @returns `this` for chaining.
   */
  off<K extends keyof Events>(event: K, listener: Listener<Events[K]>): this {
    this._listeners.get(event)?.delete(listener as Listener);
    this._onceListeners.get(event)?.delete(listener as Listener);
    return this;
  }

  /**
   * Remove all listeners for a specific event, or all events.
   * @param event - Optional event name. If omitted, removes all listeners.
   * @returns `this` for chaining.
   */
  removeAllListeners<K extends keyof Events>(event?: K): this {
    if (event !== undefined) {
      this._listeners.delete(event);
      this._onceListeners.delete(event);
    } else {
      this._listeners.clear();
      this._onceListeners.clear();
    }
    return this;
  }

  /**
   * Emit an event, calling all registered listeners.
   * @param event - The event name to emit.
   * @param args - Arguments to pass to listeners.
   * @returns `true` if the event had listeners, `false` otherwise.
   */
  protected emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    const listeners = this._listeners.get(event);
    const onceListeners = this._onceListeners.get(event);

    let hasListeners = false;

    if (listeners && listeners.size > 0) {
      hasListeners = true;
      for (const listener of listeners) {
        listener(...args);
      }
    }

    if (onceListeners && onceListeners.size > 0) {
      hasListeners = true;
      for (const listener of onceListeners) {
        listener(...args);
      }
      onceListeners.clear();
    }

    return hasListeners;
  }

  /**
   * Get the count of listeners for a specific event.
   */
  listenerCount<K extends keyof Events>(event: K): number {
    const normal = this._listeners.get(event)?.size ?? 0;
    const once = this._onceListeners.get(event)?.size ?? 0;
    return normal + once;
  }
}
