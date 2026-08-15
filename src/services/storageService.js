/**
 * Abstract storage layer.
 *
 * All persistence goes through this module. Swap the backend by
 * replacing the implementation below with a remote adapter
 * (Firebase / Supabase / API) later - the rest of the app stays
 * unchanged because it only talks to this interface.
 *
 * Interface: getAll(store), get(store, id), put(store, record), remove(store, id), count(store)
 */
import * as idb from '../db/database'

class MemoryBackend {
  constructor() {
    this.data = new Map()
    for (const s of idb.STORES) this.data.set(s, new Map())
  }
  async getAll(store) {
    return [...this.data.get(store).values()]
  }
  async get(store, id) {
    return this.data.get(store).get(id) ?? null
  }
  async put(store, record) {
    this.data.get(store).set(record.id, record)
    return record
  }
  async remove(store, id) {
    this.data.get(store).delete(id)
  }
  async count(store) {
    return this.data.get(store).size
  }
}

let backend = null

function getBackend() {
  if (backend) return backend
  backend = new MemoryBackend()
  // Try to upgrade to IndexedDB; fall back silently to memory.
  idb
    .idbCount('assets')
    .then(() => {
      backend = new IdbBackend()
    })
    .catch(() => {})
  return backend
}

class IdbBackend {
  async getAll(store) {
    return idb.idbGetAll(store)
  }
  async get(store, id) {
    return idb.idbGet(store, id)
  }
  async put(store, record) {
    await idb.idbPut(store, record)
    return record
  }
  async remove(store, id) {
    await idb.idbDelete(store, id)
  }
  async count(store) {
    return idb.idbCount(store)
  }
}

export const storage = {
  getAll: (store) => getBackend().getAll(store),
  get: (store, id) => getBackend().get(store, id),
  put: (store, record) => getBackend().put(store, record),
  remove: (store, id) => getBackend().remove(store, id),
  count: (store) => getBackend().count(store),
}
