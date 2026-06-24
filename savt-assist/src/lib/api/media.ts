import Cookies from 'js-cookie'
import { apiClient, API_URL } from './client'
import type { PaginatedResponse } from '@/types'

export interface CabinetDocument {
  id: number
  cabinet_id: number
  title: string
  doc_type: string
  file_url: string
  file_size_bytes: number
  mime_type: string
  requires_approval: boolean
  version: number
  tags: { id: number; name: string; scope: string }[]
  created_at: string
  updated_at: string
}

export interface CabinetPhoto {
  id: number
  cabinet_id: number
  url: string
  caption: string | null
  sort_order: number
  created_at: string
}

function toFullUrl(url: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_URL}${url}`
}

async function uploadMultipart<T>(path: string, form: FormData): Promise<T> {
  const token = Cookies.get('access_token')
  const res = await fetch(`/backend${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => 'Upload failed')
    throw new Error(err)
  }
  return res.json()
}

export const mediaApi = {
  listDocuments: (cabinetId: number): Promise<PaginatedResponse<CabinetDocument>> =>
    apiClient.get('/admin/documents', { params: { cabinet_id: cabinetId, size: 100 } }).then(r => r.data),

  uploadDocument: (cabinetId: number, file: File, title?: string, requiresApproval = false): Promise<CabinetDocument> => {
    const form = new FormData()
    form.append('file', file)
    form.append('cabinet_id', String(cabinetId))
    if (title) form.append('title', title)
    form.append('requires_approval', String(requiresApproval))
    return uploadMultipart('/admin/documents', form)
  },

  deleteDocument: (docId: number) => apiClient.delete(`/admin/documents/${docId}`),

  downloadDocument: async (fileUrl: string, filename: string) => {
    const url = toFullUrl(fileUrl)
    try {
      const res = await fetch(url)
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

  listPhotos: (cabinetId: number): Promise<PaginatedResponse<CabinetPhoto>> =>
    apiClient.get('/admin/photos', { params: { cabinet_id: cabinetId, size: 100 } }).then(r => r.data),

  uploadPhoto: (cabinetId: number, file: File, caption?: string): Promise<CabinetPhoto> => {
    const form = new FormData()
    form.append('file', file)
    form.append('cabinet_id', String(cabinetId))
    if (caption) form.append('caption', caption)
    return uploadMultipart('/admin/photos', form)
  },

  deletePhoto: (photoId: number) => apiClient.delete(`/admin/photos/${photoId}`),

  updatePhoto: (photoId: number, caption: string | null, sort_order: number): Promise<CabinetPhoto> =>
    apiClient.patch(`/admin/photos/${photoId}`, { caption, sort_order }).then(r => r.data),

  updateDocumentTags: (docId: number, tagIds: number[]): Promise<void> =>
    apiClient.put(`/admin/documents/${docId}/tags`, { tag_ids: tagIds }).then(() => undefined),

  toFullUrl,
}
