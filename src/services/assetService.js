import { storage } from './storageService'
import { uid } from '../utils/fileUtils'

const STORE = 'assets'

export const assetService = {
  async list(type) {
    const all = await storage.getAll(STORE)
    const sorted = all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return type ? sorted.filter((a) => a.type === type) : sorted
  },

  async get(id) {
    return storage.get(STORE, id)
  },

  /**
   * @param {{ name: string, type: 'logo'|'signature', dataUrl: string }} asset
   */
  async save(asset) {
    const now = Date.now()
    const record = {
      id: uid(),
      name: asset.name,
      type: asset.type,
      dataUrl: asset.dataUrl,
      createdAt: now,
    }
    await storage.put(STORE, record)
    return record
  },

  async remove(id) {
    await storage.remove(STORE, id)
  },

  async count(type) {
    const all = await this.list(type)
    return all.length
  },

  /** Build a lookup map id -> asset (used for template validation & generation). */
  async toMap() {
    const all = await this.list()
    const map = {}
    for (const a of all) map[a.id] = a
    return map
  },
}
