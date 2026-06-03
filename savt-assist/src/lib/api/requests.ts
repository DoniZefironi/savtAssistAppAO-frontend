import { apiClient } from './client'
import type { ServiceRequest, AdditionRequest, ShareRequest, DocumentRequest, PaginatedResponse } from '@/types'

export type { ServiceRequest, AdditionRequest, ShareRequest, DocumentRequest }

interface ListParams {
  status?: string
  search?: string
  page?: number
  size?: number
}

export const requestsApi = {
  getServiceRequests: async (params?: ListParams) => {
    const { data } = await apiClient.get<PaginatedResponse<ServiceRequest>>('/admin/service-requests', { params })
    return data
  },

  updateServiceRequestStatus: async (id: number, status: string) => {
    const { data } = await apiClient.patch<ServiceRequest>(`/admin/service-requests/${id}/status`, { status })
    return data
  },

  getAdditions: async (params?: ListParams) => {
    const { data } = await apiClient.get<PaginatedResponse<AdditionRequest>>('/admin/cabinet-requests/additions', { params })
    return data
  },

  approveAddition: async (id: number, cabinet_id: number, admin_response: string | null) => {
    const { data } = await apiClient.post(`/admin/cabinet-requests/additions/${id}/approve`, { cabinet_id, admin_response })
    return data
  },

  rejectAddition: async (id: number, admin_response: string) => {
    const { data } = await apiClient.post(`/admin/cabinet-requests/additions/${id}/reject`, { admin_response })
    return data
  },

  getShares: async (params?: ListParams) => {
    const { data } = await apiClient.get<PaginatedResponse<ShareRequest>>('/admin/cabinet-requests/shares', { params })
    return data
  },

  approveShare: async (id: number, admin_response: string | null) => {
    const { data } = await apiClient.post(`/admin/cabinet-requests/shares/${id}/approve`, { admin_response })
    return data
  },

  rejectShare: async (id: number, admin_response: string) => {
    const { data } = await apiClient.post(`/admin/cabinet-requests/shares/${id}/reject`, { admin_response })
    return data
  },

  getDocumentRequests: async (params?: ListParams) => {
    const { data } = await apiClient.get<PaginatedResponse<DocumentRequest>>('/admin/document-requests', { params })
    return data
  },

  approveDocumentRequest: async (id: number, admin_response: string | null) => {
    const { data } = await apiClient.post(`/admin/document-requests/${id}/approve`, { admin_response })
    return data
  },

  rejectDocumentRequest: async (id: number, admin_response: string) => {
    const { data } = await apiClient.post(`/admin/document-requests/${id}/reject`, { admin_response })
    return data
  },
}
