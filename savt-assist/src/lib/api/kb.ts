import Cookies from 'js-cookie'
import { apiClient, API_URL } from './client'
import type { PaginatedResponse } from '@/types'

export interface KbCategory {
  id: number
  parent_id: number | null
  name: string
  slug: string
  description: string | null
  sort_order: number
}

export interface KbArticleList {
  id: number
  category_id: number
  title: string
  slug: string
  description: string | null
  created_at: string
  tags: Tag[]
  attachment_count: number
}

export interface KbArticleDetail {
  id: number
  category_id: number
  title: string
  slug: string
  description: string | null
  version: number
  created_at: string
  updated_at: string
  tags: Tag[]
  attachments: KbAttachment[]
}

export interface KbAttachment {
  id: number
  article_id: number
  file_url: string
  file_size_bytes: number
  doc_type: string
  mime_type: string
  title: string
  created_at: string
}

export interface Tag {
  id: number
  name: string
  scope: 'document' | 'cabinet'
}

async function multipartPost<T>(path: string, form: FormData): Promise<T> {
  const token = Cookies.get('access_token')
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}

export const kbApi = {
  // Categories
  listCategories: (): Promise<KbCategory[]> =>
    apiClient.get('/admin/kb/categories').then(r => r.data),

  createCategory: (name: string, parent_id?: number | null, description?: string | null): Promise<KbCategory> =>
    apiClient.post('/admin/kb/categories', { name, parent_id: parent_id ?? null, description: description ?? null }).then(r => r.data),

  updateCategory: (id: number, data: Partial<{ name: string; description: string | null; sort_order: number }>): Promise<KbCategory> =>
    apiClient.patch(`/admin/kb/categories/${id}`, data).then(r => r.data),

  deleteCategory: (id: number) => apiClient.delete(`/admin/kb/categories/${id}`),

  // Articles
  listArticles: (params?: {
    category_id?: number
    search?: string
    sort_by?: string
    sort_order?: string
    tag_ids?: number[]
    page?: number
    size?: number
  }): Promise<PaginatedResponse<KbArticleList>> =>
    apiClient.get('/kb/articles', { params }).then(r => r.data),

  getArticle: (id: number): Promise<KbArticleDetail> =>
    apiClient.get(`/kb/articles/${id}`).then(r => r.data),

  createArticle: (data: { category_id: number; title: string; description?: string | null }): Promise<KbArticleDetail> =>
    apiClient.post('/admin/kb/articles', data).then(r => r.data),

  updateArticle: (id: number, data: { title?: string | null; description?: string | null; category_id?: number | null }): Promise<KbArticleDetail> =>
    apiClient.patch(`/admin/kb/articles/${id}`, data).then(r => r.data),

  deleteArticle: (id: number) => apiClient.delete(`/admin/kb/articles/${id}`),

  // Attachments
  uploadAttachment: (articleId: number, file: File): Promise<KbAttachment> => {
    const form = new FormData()
    form.append('file', file)
    return multipartPost(`/admin/kb/articles/${articleId}/attachments`, form)
  },

  deleteAttachment: (articleId: number, attId: number) =>
    apiClient.delete(`/admin/kb/articles/${articleId}/attachments/${attId}`),

  downloadAttachment: async (articleId: number, attId: number, filename: string) => {
    const token = Cookies.get('access_token')
    const url = `${API_URL}/kb/articles/${articleId}/attachments/${attId}/download`
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(url, '_blank')
    }
  },

  // Tags
  listTags: (scope?: 'document' | 'cabinet'): Promise<Tag[]> =>
    apiClient.get('/tags', { params: scope ? { scope } : undefined }).then(r => r.data),

  createTag: (name: string, scope: 'document' | 'cabinet' = 'document'): Promise<Tag> =>
    apiClient.post('/admin/tags', { name, scope }).then(r => r.data),

  deleteTag: (id: number) => apiClient.delete(`/admin/tags/${id}`),

  updateArticleTags: (articleId: number, tagIds: number[]): Promise<void> =>
    apiClient.put(`/admin/kb-articles/${articleId}/tags`, { tag_ids: tagIds }).then(() => undefined),
}
