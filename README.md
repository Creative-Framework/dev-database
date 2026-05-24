# Dev-Database

### ⚡ A High-Performance, Typed Multi-Driver Database

<div align="center">
  <p>
    <a href="https://discord.gg/FqceHDU8QP"><img src="https://img.shields.io/discord/1243273138545098943?color=5865F2&logo=discord&logoColor=white" alt="Discord server" /></a>
    <a href="https://www.npmjs.com/package/dev-database"><img src="https://img.shields.io/npm/v/dev-database.svg?maxAge=3600" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/dev-database"><img src="https://img.shields.io/npm/dt/dev-database.svg?maxAge=3600" alt="npm downloads" /></a>
  </p>
</div>

---

## ✨ Features

- 🏎️ **Blazing Fast** — In-memory data with debounced writes
- 🔌 **Multi-Driver** — JSON, MySQL, SQLite — same API
- 📝 **Full TypeScript Support** — Built-in types with generics & auto-completion
- 🔔 **Event System** — Listen to `set`, `delete`, `clear`, `ready`, `save`, `error`
- 📂 **Dot Notation** — Access nested keys like `users.123.name`
- 📦 **Collections** — MongoDB-like insert/find/update/delete with query operators
- ⏱️ **TTL (Time-To-Live)** — Auto-expiring keys
- ➕ **Math Operations** — `add`, `subtract`, `multiply`, `divide`
- 📋 **Array Operations** — `push`, `pull`, `includes`
- 💾 **Backup & Restore** — Save/load snapshots
- 🚫 **Zero Core Dependencies** — Only uses Node.js built-in modules (JSON driver)

---

## 📦 Installation

```bash
npm install dev-database
```

### Optional Drivers

| Driver  | Install                        |
|---------|--------------------------------|
| JSON    | Built-in (no extra install)    |
| MySQL   | `npm install mysql2`           |
| SQLite  | `npm install better-sqlite3`   |

---

## 🚀 Quick Start

### JavaScript
```js
const DevDatabase = require('dev-database').default;

// JSON driver (default)
const db = new DevDatabase({ driver: 'json', filePath: './database.json' });

db.set('name', 'Ameen');
console.log(db.get('name')); // 'Ameen'
```

### TypeScript
```ts
import DevDatabase from 'dev-database';

const db = new DevDatabase({ driver: 'json', filePath: './database.json' });

db.set('name', 'Ameen');
console.log(db.get<string>('name')); // 'Ameen'
```

---

## ⚙️ Configuration

### JSON Driver (default)
```ts
const db = new DevDatabase({
  driver: 'json',
  filePath: './data/database.json',  // Default: './database.json'
  autoSaveInterval: 300,             // Debounce save interval (ms)
  pretty: true,                      // Pretty print JSON
  autoCreate: true,                  // Auto-create file & directories
  separator: '.',                    // Nested key separator
});
```

JSON driver auto-loads data in the constructor — no need to call `init()`.

### MySQL Driver
```ts
const db = new DevDatabase({
  driver: 'mysql',
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'myapp',
  tableName: 'dev_database',        // Table for key-value storage
  separator: '.',
});

await db.init();  // Required: connect & load data
```

### SQLite Driver
```ts
const db = new DevDatabase({
  driver: 'sqlite',
  filePath: './data/database.sqlite',
  tableName: 'dev_database',        // Table for key-value storage
  separator: '.',
});

await db.init();  // Required: connect & load data
```

> **Note:** MySQL and SQLite drivers require `await db.init()` after construction to connect and load data.

---

## 📖 API Reference

### Core CRUD

```ts
// Set a value
db.set('key', 'value');

// Get a value (with optional default)
db.get('key');
db.get('missing', 'fallback');
db.get<number>('score', 0);

// Check if key exists
db.has('key'); // true

// Delete a key
db.delete('key'); // true

// Clear all data
db.clear();
```

### 📂 Dot Notation (Nested Keys)

```ts
db.set('users.123.name', 'Ameen');
db.set('users.123.level', 10);

db.get('users.123.name');   // 'Ameen'
db.has('users.123.level');  // true
db.delete('users.123.level');
```

### ➕ Math Operations

```ts
db.set('coins', 100);

db.add('coins', 50);       // 150
db.subtract('coins', 30);  // 120
db.multiply('coins', 2);   // 240
db.divide('coins', 4);     // 60
```

### 📋 Array Operations

```ts
db.set('inventory', []);

db.push('inventory', 'sword', 'shield');
db.pull('inventory', 'sword');
db.includes('inventory', 'shield'); // true
```

### ⏱️ TTL (Auto-Expiring Keys)

```ts
// Expires after 1 hour
db.set('session', { token: 'abc123' }, { ttl: 3600000 });

// Later...
db.get('session'); // null (after expiration)
```

### 📦 Bulk Operations

```ts
// Set multiple keys at once
db.bulkSet([
  ['key1', 'value1'],
  ['key2', 'value2'],
]);

// Or with an object
db.bulkSet({ key1: 'value1', key2: 'value2' });

// Get multiple keys
db.bulkGet(['key1', 'key2']);

// Delete multiple keys
db.bulkDelete(['key1', 'key2']);
```

---

## 📦 Collections (MongoDB-like)

```ts
interface User {
  name: string;
  age: number;
  role: string;
}

const users = db.collection<User>('users');

// Insert
users.insert({ name: 'Ameen', age: 20, role: 'admin' });
users.insertMany([
  { name: 'Sara', age: 25, role: 'user' },
  { name: 'Ali', age: 18, role: 'user' },
]);

// Find with query operators
users.find({ age: { $gt: 18 } });
users.find({ role: 'admin' });
users.find({}, { sort: { age: -1 }, limit: 10 });
users.findOne({ name: 'Ameen' });
users.findById('abc-123');

// Update
users.update({ name: 'Ameen' }, { age: 21 });
users.update({ role: 'user' }, { $inc: { age: 1 } });
users.update({ name: 'Sara' }, { $push: { badges: 'vip' } });

// Delete
users.delete({ role: 'user' });
users.deleteById('abc-123');

// Utilities
users.count({ role: 'admin' });
users.all();
users.drop();
```

### Query Operators

| Operator   | Description              | Example                          |
|------------|--------------------------|----------------------------------|
| `$gt`      | Greater than             | `{ age: { $gt: 18 } }`          |
| `$gte`     | Greater than or equal    | `{ age: { $gte: 18 } }`         |
| `$lt`      | Less than                | `{ age: { $lt: 30 } }`          |
| `$lte`     | Less than or equal       | `{ age: { $lte: 30 } }`         |
| `$ne`      | Not equal                | `{ role: { $ne: 'admin' } }`    |
| `$in`      | Value in array           | `{ role: { $in: ['a', 'b'] } }` |
| `$nin`     | Value not in array       | `{ role: { $nin: ['x'] } }`     |
| `$exists`  | Key exists               | `{ email: { $exists: true } }`  |
| `$regex`   | Regex match              | `{ name: { $regex: '^A' } }`    |

---

## 🔔 Events

```ts
db.on('ready', () => {
  console.log('Database loaded!');
});

db.on('set', (key, value, oldValue) => {
  console.log(`${key} changed from ${oldValue} to ${value}`);
});

db.on('delete', (key, value) => {
  console.log(`${key} was deleted (was: ${value})`);
});

db.on('clear', () => {
  console.log('Database cleared!');
});

db.on('save', () => {
  console.log('Data saved!');
});

db.on('error', (error) => {
  console.error('Database error:', error);
});
```

---

## 💾 Backup & Restore

Works with all drivers — exports/imports data as JSON.

```ts
// Create a backup
await db.backup('./backups/db-backup.json');

// Restore from backup
await db.restore('./backups/db-backup.json');
```

---

## 🛠️ Utility Methods

```ts
db.keys();                    // ['key1', 'key2', ...]
db.values();                  // [value1, value2, ...]
db.entries();                 // [['key1', value1], ...]
db.size;                      // 42
db.toJSON();                  // Deep clone of all data
db.forEach((key, value) => { ... });
db.filter((key, value) => value > 10);
db.map((key, value) => `${key}=${value}`);

await db.save();              // Force save now
await db.close();             // Save & disconnect
await db.destroy();           // Delete all stored data
```

---

## 🎮 Discord Bot Example

```ts
import DevDatabase from 'dev-database';

const db = new DevDatabase({ driver: 'json', filePath: './data/bot.json' });
const users = db.collection<{ name: string; level: number; xp: number }>('users');

// On message
function handleMessage(userId: string, username: string) {
  let user = users.findOne({ name: username });

  if (!user) {
    users.insert({ name: username, level: 1, xp: 0 });
  } else {
    users.update({ _id: user._id }, { $inc: { xp: 10 } });

    if (user.xp >= user.level * 100) {
      users.update({ _id: user._id }, {
        $inc: { level: 1 },
        $set: { xp: 0 }
      });
    }
  }
}
```

---

## 📦 Custom Adapter

You can provide your own adapter:

```ts
import { DevDatabase, StorageAdapter } from 'dev-database';

class MyCustomAdapter implements StorageAdapter {
  readonly name = 'custom';

  async init(options: Record<string, unknown>): Promise<void> { /* ... */ }
  async load(): Promise<Record<string, unknown>> { /* ... */ }
  async save(data: Record<string, unknown>): Promise<void> { /* ... */ }
  async close(): Promise<void> { /* ... */ }
  async destroy(): Promise<void> { /* ... */ }
}

const db = new DevDatabase({ adapter: new MyCustomAdapter() });
```

---

## ⚠️ Important Notes

- Always call `await db.close()` before shutting down to prevent data loss.
- **JSON driver** auto-loads in the constructor (backward compatible).
- **MySQL/SQLite drivers** require `await db.init()` after construction.
- For JSON, the file defaults to `./database.json`.
- All data is held in memory — ideal for small to medium datasets.

---

## 📜 License

[MIT](./LICENSE)

---

### 💬 Need Help?

Join our Discord: [https://discord.gg/FqceHDU8QP](https://discord.gg/FqceHDU8QP)
