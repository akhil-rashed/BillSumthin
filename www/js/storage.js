const DB_NAME = 'billsumthin_db';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('bills')) {
        const billsStore = db.createObjectStore('bills', { keyPath: 'id' });
        billsStore.createIndex('createdAt', 'createdAt', { unique: false });
        billsStore.createIndex('category', 'category', { unique: false });
        billsStore.createIndex('provider', 'provider', { unique: false });
      }
      if (!db.objectStoreNames.contains('category_prefs')) {
        db.createObjectStore('category_prefs', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('price_history')) {
        const phStore = db.createObjectStore('price_history', { keyPath: 'id' });
        phStore.createIndex('normalizedName', 'normalizedName', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function txStore(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result?.result !== undefined ? result.result : result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSetting(key, defaultValue = null) {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
      req.onerror = () => resolve(defaultValue);
    });
  } catch {
    return defaultValue;
  }
}

export async function setSetting(key, value) {
  return txStore('settings', 'readwrite', (store) => store.put({ key, value }));
}

export async function getAllSettings() {
  const defaults = {
    theme: 'system',
    language: 'en',
    preferredCurrency: 'BDT',
    cloudSync: false,
    notifications: true,
    suspiciousThresholdPct: 25,
    geminiApiKey: ''
  };
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').getAll();
      req.onsuccess = () => {
        const out = { ...defaults };
        for (const row of req.result || []) out[row.key] = row.value;
        resolve(out);
      };
      req.onerror = () => resolve(defaults);
    });
  } catch {
    return defaults;
  }
}

export async function saveBill(bill) {
  const now = new Date().toISOString();
  const record = {
    ...bill,
    createdAt: bill.createdAt || now,
    updatedAt: now
  };
  await txStore('bills', 'readwrite', (store) => store.put(record));
  return record;
}

export async function getBillById(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bills', 'readonly');
    const req = tx.objectStore('bills').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllBills() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bills', 'readonly');
    const req = tx.objectStore('bills').getAll();
    req.onsuccess = () => {
      const list = (req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBillById(id) {
  return txStore('bills', 'readwrite', (store) => store.delete(id));
}

export async function clearAllBills() {
  await txStore('bills', 'readwrite', (store) => store.clear());
  await txStore('price_history', 'readwrite', (store) => store.clear());
}

export async function saveCategoryPreference(providerOrKeyword, categoryId) {
  if (!providerOrKeyword) return;
  const key = String(providerOrKeyword).trim().toLowerCase();
  return txStore('category_prefs', 'readwrite', (store) => store.put({ key, categoryId, updatedAt: new Date().toISOString() }));
}

export async function getCategoryPreference(providerOrKeyword) {
  if (!providerOrKeyword) return null;
  const key = String(providerOrKeyword).trim().toLowerCase();
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction('category_prefs', 'readonly');
    const req = tx.objectStore('category_prefs').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.categoryId : null);
    req.onerror = () => resolve(null);
  });
}

export async function addPriceHistoryEntries(entries = []) {
  if (!entries.length) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('price_history', 'readwrite');
    const store = tx.objectStore('price_history');
    for (const entry of entries) store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPriceHistoryForItem(normalizedName) {
  if (!normalizedName) return [];
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction('price_history', 'readonly');
    const idx = tx.objectStore('price_history').index('normalizedName');
    const req = idx.getAll(normalizedName);
    req.onsuccess = () => {
      const rows = (req.result || []).sort((a, b) => new Date(a.date) - new Date(b.date));
      resolve(rows);
    };
    req.onerror = () => resolve([]);
  });
}
