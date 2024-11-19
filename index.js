const fs = require('fs');
const path = require('path');

class DevDatabase {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.data = new Map();
    this.isSaving = false;
    this.debounceSaveTime = 500;
    this.saveTimeout = null;

    this._loadData();
  }

  async _loadData() {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileData = await fs.promises.readFile(this.filePath, 'utf8');
        const parsedData = JSON.parse(fileData);
        Object.entries(parsedData).forEach(([key, value]) => {
          this.data.set(key, value);
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  _saveData() {
    if (this.isSaving) return;
    this.isSaving = true;

    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(async () => {
      try {
        const objectData = Object.fromEntries(this.data);
        await fs.promises.writeFile(this.filePath, JSON.stringify(objectData, null, 2), 'utf8');
      } catch (error) {
        console.error('Failed to save data:', error);
      } finally {
        this.isSaving = false;
      }
    }, this.debounceSaveTime);
  }

  get(key, defaultValue = null) {
    return this.data.has(key) ? this.data.get(key) : defaultValue;
  }

  set(key, value) {
    this.data.set(key, value);
    this._saveData();
    return this;
  }

  delete(key) {
    const deleted = this.data.delete(key);
    if (deleted) this._saveData();
    return deleted;
  }

  clear() {
    this.data.clear();
    this._saveData();
    return this;
  }

  bulkSet(entries) {
    entries.forEach(([key, value]) => this.data.set(key, value));
    this._saveData();
    return this;
  }

  async close() {
    clearTimeout(this.saveTimeout);
    const objectData = Object.fromEntries(this.data);
    try {
      await fs.promises.writeFile(this.filePath, JSON.stringify(objectData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save data on close:', error);
    }
  }
}

module.exports = DevDatabase;