import { storage } from './storageService'
import { uid } from '../utils/fileUtils'
import { normalizeTemplateDesigns } from '../utils/templateDesigns'

const STORE = 'templates'

export const templateService = {
  async list() {
    const all = await storage.getAll(STORE)
    return all.map(normalizeTemplateDesigns).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  },

  async get(id) {
    const t = await storage.get(STORE, id)
    return t ? normalizeTemplateDesigns(t) : null
  },

  async save(template) {
    const now = Date.now()
    const record = {
      ...normalizeTemplateDesigns(template),
      id: template.id || uid(),
      updatedAt: now,
      createdAt: template.createdAt || now,
    }
    await storage.put(STORE, record)
    return record
  },

  async remove(id) {
    await storage.remove(STORE, id)
  },

  async duplicate(id) {
    const src = await storage.get(STORE, id)
    if (!src) return null
    const now = Date.now()
    const copy = {
      ...JSON.parse(JSON.stringify(normalizeTemplateDesigns(src))),
      id: uid(),
      name: `${src.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    }
    await storage.put(STORE, copy)
    return copy
  },

  async count() {
    return storage.count(STORE)
  },
}
