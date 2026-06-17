import { apiClient } from './client'
import type { PaginatedResponse } from '@/types'

export interface FaqCategory {
  id: number
  parent_id: number | null
  name: string
  sort_order: number
}

export interface FaqEntry {
  id: number
  category_id: number
  question: string
  answer: string
  version: number
  created_at: string
  updated_at: string
}

export const faqApi = {
  listCategories: (): Promise<FaqCategory[]> =>
    apiClient.get('/admin/faq/categories').then(r => r.data),

  createCategory: (name: string, parent_id?: number | null, sort_order?: number): Promise<FaqCategory> =>
    apiClient.post('/admin/faq/categories', { name, parent_id: parent_id ?? null, sort_order: sort_order ?? 0 }).then(r => r.data),

  updateCategory: (id: number, data: Partial<{ name: string; sort_order: number }>): Promise<FaqCategory> =>
    apiClient.patch(`/admin/faq/categories/${id}`, data).then(r => r.data),

  deleteCategory: (id: number) => apiClient.delete(`/admin/faq/categories/${id}`),

  listEntries: (params?: {
    category_id?: number
    search?: string
    sort_by?: string
    sort_order?: string
    page?: number
    size?: number
  }): Promise<PaginatedResponse<FaqEntry>> =>
    apiClient.get('/admin/faq/entries', { params }).then(r => r.data),

  createEntry: (data: { category_id: number; question: string; answer: string }): Promise<FaqEntry> =>
    apiClient.post('/admin/faq/entries', data).then(r => r.data),

  updateEntry: (id: number, data: Partial<{ question: string; answer: string }>): Promise<FaqEntry> =>
    apiClient.patch(`/admin/faq/entries/${id}`, data).then(r => r.data),

  deleteEntry: (id: number) => apiClient.delete(`/admin/faq/entries/${id}`),
}
