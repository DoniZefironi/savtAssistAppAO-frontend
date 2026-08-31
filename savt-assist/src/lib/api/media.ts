import { apiClient, authorizedFetch } from './client'
import { API_URL, toFullUrl } from './base-url'
import type { PaginatedResponse } from '@/types'
import type { Tag } from './kb'

export interface CabinetDocument {
  id: number
  cabinet_id: number | null
  project_id: number | null
  title: string
  doc_type: string
  // null у документов с ограниченным доступом — прямой подписанной ссылки они
  // не получают вовсе, качать через GET /documents/{id}/download (см. раздел 8.1)
  file_url: string | null
  file_size_bytes: number
  mime_type: string
  // Требует согласования: пользователь видит документ, но без ссылки, и может
  // запросить доступ. Не путать с is_internal.
  requires_approval: boolean
  // Служебный (счёт, договор): пользователю не виден ни в одном ответе вообще,
  // download и запрос доступа отвечают 404. Виден только операторам и админам.
  is_internal?: boolean
  version: number
  tags: Tag[]
  created_at: string
  updated_at: string
}

// Фото привязано либо к ШУ, либо к проекту — ровно одно из двух заполнено
// (ck_photo_cabinet_or_project на уровне БД), как и у документов.
export interface CabinetPhoto {
  id: number
  cabinet_id: number | null
  project_id: number | null
  url: string
  caption: string | null
  sort_order: number
  created_at: string
}

function saveBlob(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

async function uploadMultipart<T>(path: string, form: FormData): Promise<T> {
  const res = await authorizedFetch(path, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.text().catch(() => 'Upload failed')
    throw new Error(err)
  }
  return res.json()
}

export const mediaApi = {
  listDocuments: (cabinetId: number): Promise<PaginatedResponse<CabinetDocument>> =>
    apiClient.get('/admin/documents', { params: { cabinet_id: cabinetId, size: 100 } }).then(r => r.data),

  uploadDocument: (cabinetId: number, file: File, title?: string, requiresApproval = false, isInternal = false): Promise<CabinetDocument> => {
    const form = new FormData()
    form.append('file', file)
    form.append('cabinet_id', String(cabinetId))
    if (title) form.append('title', title)
    form.append('requires_approval', String(requiresApproval))
    form.append('is_internal', String(isInternal))
    return uploadMultipart('/admin/documents', form)
  },

  // Документация проекта в целом (не привязанная к конкретному ШУ) — тот же
  // эндпоинт /admin/documents, но с project_id вместо cabinet_id (ровно одно
  // из двух, см. README-backend.md, «Рут admin: documents»)
  listProjectDocuments: (projectId: number): Promise<PaginatedResponse<CabinetDocument>> =>
    apiClient.get('/admin/documents', { params: { project_id: projectId, size: 100 } }).then(r => r.data),

  uploadProjectDocument: (projectId: number, file: File, title?: string, requiresApproval = false, isInternal = false): Promise<CabinetDocument> => {
    const form = new FormData()
    form.append('file', file)
    form.append('project_id', String(projectId))
    if (title) form.append('title', title)
    form.append('requires_approval', String(requiresApproval))
    form.append('is_internal', String(isInternal))
    return uploadMultipart('/admin/documents', form)
  },

  deleteDocument: (docId: number) => apiClient.delete(`/admin/documents/${docId}`),

  // Единственный способ открыть документ, который синхронизация подхватила
  // прямо с NAS-папки, — такие всегда заводятся с is_internal: true (см.
  // README-backend.md, «Файл положили в папку напрямую»).
  updateDocument: (docId: number, patch: { requires_approval?: boolean; is_internal?: boolean }): Promise<CabinetDocument> =>
    apiClient.patch(`/admin/documents/${docId}`, patch).then(r => r.data),

  downloadDocument: async (fileUrl: string, filename: string) => {
    const url = toFullUrl(fileUrl)
    try {
      // Через authorizedFetch (same-origin прокси /backend), а не напрямую по
      // абсолютной ссылке: там другой origin, и обычный fetch упирается в CORS,
      // молча падая в catch — а он открывает файл вместо скачивания. Ровно
      // тот же случай был у вложений чата, см. attachment-view.tsx.
      const path = url.startsWith(API_URL) ? url.slice(API_URL.length) : url
      const res = await authorizedFetch(path)
      if (!res.ok) throw new Error(`Download failed: ${res.status}`)
      saveBlob(await res.blob(), filename)
    } catch {
      window.open(url, '_blank')
    }
  },

  // Для документов без прямой ссылки (file_url: null у требующих согласования):
  // качаем через эндпоинт с проверкой прав, а не по подписанной ссылке.
  downloadDocumentById: async (docId: number, filename: string) => {
    const res = await authorizedFetch(`/documents/${docId}/download`)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    saveBlob(await res.blob(), filename)
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

  // Фото проекта в целом — тот же эндпоинт, но с project_id вместо cabinet_id
  // (ровно одно из двух, иначе 422).
  listProjectPhotos: (projectId: number): Promise<PaginatedResponse<CabinetPhoto>> =>
    apiClient.get('/admin/photos', { params: { project_id: projectId, size: 100 } }).then(r => r.data),

  uploadProjectPhoto: (projectId: number, file: File, caption?: string): Promise<CabinetPhoto> => {
    const form = new FormData()
    form.append('file', file)
    form.append('project_id', String(projectId))
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
