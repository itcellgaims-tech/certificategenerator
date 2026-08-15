/**
 * IndexedDB wrapper. The database is opened once and reused.
 * Stores are created automatically on first open.
 */

const DB_NAME = 'certgen-db'
const DB_VERSION = 1
const STORES = ['templates', 'assets', 'batches']

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function requestToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getTx(db, store, mode = 'readonly') {
  const tx = db.transaction(store, mode)
  return { tx, os: tx.objectStore(store) }
}

export async function idbGetAll(store) {
  const db = await openDb()
  const { os } = getTx(db, store)
  return requestToPromise(os.getAll())
}

export async function idbGet(store, id) {
  const db = await openDb()
  const { os } = getTx(db, store)
  return requestToPromise(os.get(id))
}

export async function idbPut(store, record) {
  const db = await openDb()
  const { os } = getTx(db, store, 'readwrite')
  await requestToPromise(os.put(record))
}

export async function idbDelete(store, id) {
  const db = await openDb()
  const { os } = getTx(db, store, 'readwrite')
  await requestToPromise(os.delete(id))
}

export async function idbClear(store) {
  const db = await openDb()
  const { os } = getTx(db, store, 'readwrite')
  await requestToPromise(os.clear())
}

export async function idbCount(store) {
  const db = await openDb()
  const { os } = getTx(db, store)
  return requestToPromise(os.count())
}

export { STORES }
