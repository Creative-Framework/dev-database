export interface StorageAdapter {
  /** Display name for this adapter type. */
  readonly name: string;

  /** Initialize/connect to the storage backend. */
  init(options: Record<string, unknown>): Promise<void>;

  /** Load all data from storage into memory. */
  load(): Promise<Record<string, unknown>>;

  /** Save all data from memory to storage. */
  save(data: Record<string, unknown>): Promise<void>;

  /** Close/disconnect from the storage backend. */
  close(): Promise<void>;

  /** Destroy/delete all stored data. */
  destroy(): Promise<void>;
}
