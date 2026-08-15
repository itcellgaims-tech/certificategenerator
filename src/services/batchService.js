import { storage } from './storageService'
import { uid } from '../utils/fileUtils'

const STORE = 'batches'

export const batchService = {
  async list() {
    const all = await storage.getAll(STORE)
    return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  },

  async get(id) {
    return storage.get(STORE, id)
  },

  async save(batch) {
    const now = Date.now()
    const record = {
      id: batch.id || uid(),
      name: batch.name,
      templateId: batch.templateId,
      templateName: batch.templateName,
      template: batch.template, // snapshot so history is reproducible later
      defaultDesignKey: batch.defaultDesignKey,
      common: batch.common,
      rows: batch.rows,
      certificateCount: batch.certificateCount ?? batch.rows?.length ?? 0,
      createdAt: batch.createdAt || now,
    }
    await storage.put(STORE, record)
    return record
  },

  async remove(id) {
    await storage.remove(STORE, id)
  },

  async count() {
    return storage.count(STORE)
  },
}
