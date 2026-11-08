// IndexedDB の小さなラッパー。写真（Blob）もそのまま保存する
const DB_NAME = 'tokinaoshi-note';
const DB_VERSION = 1;
const STORES = ['problems', 'tests', 'images', 'kv'];

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    let result;
    Promise.resolve(fn(t.objectStore(store))).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('transaction aborted'));
  });
}

export const db = {
  get: (store, id) => tx(store, 'readonly', (s) => wrap(s.get(id))),
  all: (store) => tx(store, 'readonly', (s) => wrap(s.getAll())),
  put: (store, value) => tx(store, 'readwrite', (s) => wrap(s.put(value))),
  putMany: (store, values) => tx(store, 'readwrite', (s) => Promise.all(values.map((v) => wrap(s.put(v))))),
  delete: (store, id) => tx(store, 'readwrite', (s) => wrap(s.delete(id))),
  deleteMany: (store, ids) => tx(store, 'readwrite', (s) => Promise.all(ids.map((id) => wrap(s.delete(id))))),
  clear: (store) => tx(store, 'readwrite', (s) => wrap(s.clear())),
};

export async function getSetting(key, fallback) {
  const row = await db.get('kv', key);
  return row ? row.value : fallback;
}
export function setSetting(key, value) {
  return db.put('kv', { id: key, value });
}

// 画像の保存・読み出し。表示用の URL はキャッシュして使い回す
const urlCache = new Map();
export async function saveImage(blob) {
  const id = uid();
  await db.put('images', { id, blob, type: blob.type });
  return id;
}
export async function imageBlob(id) {
  const row = await db.get('images', id);
  return row ? row.blob : null;
}
export async function imageURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await imageBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}
export async function deleteImages(ids) {
  const list = ids.filter(Boolean);
  for (const id of list) {
    if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
  }
  if (list.length) await db.deleteMany('images', list);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
