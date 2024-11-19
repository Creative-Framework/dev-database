
# Dev-Database

A Lightning-Fast, Lightweight JSON File-Based Database

<div align="center">
  <p>
    <a href="https://discord.gg/FqceHDU8QP"><img src="https://img.shields.io/discord/1243273138545098943?color=5865F2&logo=discord&logoColor=white" alt="Discord server" /></a>
    <a href="https://www.npmjs.com/package/dev-database"><img src="https://img.shields.io/npm/v/dev-database.svg?maxAge=3600" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/dev-database"><img src="https://img.shields.io/npm/dt/dev-database.svg?maxAge=3600" alt="npm downloads" /></a>
  </p>
</div>  

## Overview

`Dev-Database` is a high-performance, lightweight npm package that offers a fast and efficient way to perform database operations using JSON files. It's designed for developers who need a quick, easy-to-use solution for storing and retrieving data. Now with enhanced speed and asynchronous operations, it’s perfect for both small-scale projects and lightweight Discord bots.

  

## Features

-  **Blazing Fast**: Optimized for handling large datasets (e.g., 100,000+ keys) in milliseconds.

-  **Easy-to-Use API**: Simple methods for CRUD operations.

-  **In-Memory Efficiency**: Data is processed in memory for ultra-fast reads and writes.

-  **Persistent Storage**: Periodic and asynchronous writes to a JSON file.

-  **Bulk Operations**: Quickly set multiple key-value pairs in one call.

  

## Installation

Install `Dev-Database` via npm:

```bash

npm  install  dev-database

```

  

## Getting Started

Create an instance of `DevDatabase` by providing the path to your JSON file.

  

### Example Usage:

```js

const  DevDatabase  =  require('dev-database');

  

// Create an instance of DevDatabase

const  db  =  new  DevDatabase('database.json');

  

// Set a key-value pair

db.set('key1',  'value1');

console.log(db.get('key1')); // Output: 'value1'

  

// Delete a key

db.delete('key1');

  

// Bulk set key-value pairs

db.bulkSet([

['key2',  'value2'],

['key3',  'value3']

]);

  

// Retrieve a value with a default fallback

console.log(db.get('nonexistentKey',  'defaultValue')); // Output: 'defaultValue'

  

// Clear all data

db.clear();

  

// Close the database (force save to disk)

db.close();

```

  

## Methods

  

### `set(key, value)`

Sets a key-value pair in the database.

```js

db.set('key',  'value');

```

  

### `get(key, defaultValue = null)`

Retrieves the value associated with a key, or returns `defaultValue` if the key doesn't exist.

```js

const  value  =  db.get('key',  'default');

```

  

### `delete(key)`

Deletes a key-value pair from the database.

```js

db.delete('key');

```

  

### `bulkSet(entries)`

Sets multiple key-value pairs in a single operation.

```js

db.bulkSet([

['key1',  'value1'],

['key2',  'value2']

]);

```

  

### `clear()`

Clears all key-value pairs in the database.

```js

db.clear();

```

  

### `close()`

Forces the database to save all data to disk immediately.

```js

db.close();

```

  

---

  

## Advanced Features

  

### In-Memory Processing

All CRUD operations happen in memory for maximum performance, with asynchronous writes to disk.

  

### Debounced Saving

Changes to the database are saved to the JSON file in batches every 500ms, reducing the overhead of frequent file writes.

  

---

  

## Warning!

- If the JSON file doesn’t exist, `Dev-Database` will create a new one.

- Ensure you close the database with `close()` when shutting down your application to prevent data loss.

  

---

  

### Ideal Use Cases

-  **Discord Bots**: Store server-specific configurations, user preferences, or leveling systems.

-  **Small Projects**: Perfect for personal or lightweight development projects.

-  **Prototyping**: Quickly implement a simple database without external dependencies.

  

---

  

### Contact / Need Help?

Join my Discord Developers Server:

[https://discord.gg/FqceHDU8QP](https://discord.gg/FqceHDU8QP)
