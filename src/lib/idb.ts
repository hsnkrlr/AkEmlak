/** Küçük bir IndexedDB sarmalayıcısı. Tüm yönetici verileri tarayıcıda burada tutulur. */
const DB_NAME = 'akemlak';
const DB_VERSION = 1;
export type StoreName = 'listings' | 'images' | 'meta' | 'session' | 'guard';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('listings')) db.createObjectStore('listings', { keyPath: 'id' });
      for (const s of ['images', 'meta', 'session', 'guard'] as const) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export async function idbGet<T>(name: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return wrap((await store(name, 'readonly')).get(key)) as Promise<T | undefined>;
}

export async function idbGetAll<T>(name: StoreName): Promise<T[]> {
  return wrap((await store(name, 'readonly')).getAll()) as Promise<T[]>;
}

export async function idbKeys(name: StoreName): Promise<IDBValidKey[]> {
  return wrap((await store(name, 'readonly')).getAllKeys());
}

export async function idbPut(name: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
  await wrap((await store(name, 'readwrite')).put(value, key));
}

export async function idbDelete(name: StoreName, key: IDBValidKey): Promise<void> {
  await wrap((await store(name, 'readwrite')).delete(key));
}

export async function idbClear(name: StoreName): Promise<void> {
  await wrap((await store(name, 'readwrite')).clear());
}
