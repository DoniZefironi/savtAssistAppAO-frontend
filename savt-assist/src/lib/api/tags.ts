import { apiClient } from './client'

export interface Tag {
  id: number
  name: string
  scope: string
}

export const tagsApi = {
  getAll: async (scope?: string): Promise<Tag[]> => {
    const { data } = await apiClient.get('/tags', { params: scope ? { scope } : {} })
    return data
  },

  create: async (name: string, scope: string): Promise<Tag> => {
    const { data } = await apiClient.post('/admin/tags', { name, scope })
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/tags/${id}`)
  },
}
