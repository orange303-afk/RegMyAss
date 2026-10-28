/**
 * QuickPass - IndexedDB Storage
 * Stores structured account records persistently and efficiently.
 */

import { StoredAccount } from '../shared/types';

export class AppDatabase {
  private static readonly DB_NAME = 'QuickPassDB';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_ACCOUNTS = 'accounts';
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(AppDatabase.DB_NAME, AppDatabase.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(AppDatabase.STORE_ACCOUNTS)) {
          const store = db.createObjectStore(AppDatabase.STORE_ACCOUNTS, { keyPath: 'id' });
          store.createIndex('origin', 'origin', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  public async saveAccount(account: StoredAccount): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AppDatabase.STORE_ACCOUNTS, 'readwrite');
      const store = tx.objectStore(AppDatabase.STORE_ACCOUNTS);
      const req = store.put(account);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getAccountByOrigin(origin: string): Promise<StoredAccount | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AppDatabase.STORE_ACCOUNTS, 'readonly');
      const store = tx.objectStore(AppDatabase.STORE_ACCOUNTS);
      const index = store.index('origin');
      const req = index.getAll(origin);

      req.onsuccess = () => {
        const results = req.result as StoredAccount[];
        if (results && results.length > 0) {
          // Return newest account for this origin
          results.sort((a, b) => b.createdAt - a.createdAt);
          resolve(results[0]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async getAccountById(id: string): Promise<StoredAccount | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AppDatabase.STORE_ACCOUNTS, 'readonly');
      const store = tx.objectStore(AppDatabase.STORE_ACCOUNTS);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAllAccounts(): Promise<StoredAccount[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AppDatabase.STORE_ACCOUNTS, 'readonly');
      const store = tx.objectStore(AppDatabase.STORE_ACCOUNTS);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = (req.result as StoredAccount[]) || [];
        items.sort((a, b) => b.createdAt - a.createdAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async deleteAccount(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AppDatabase.STORE_ACCOUNTS, 'readwrite');
      const store = tx.objectStore(AppDatabase.STORE_ACCOUNTS);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
