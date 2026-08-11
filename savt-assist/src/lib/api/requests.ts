import { apiClient } from './client'
import type { ServiceRequest, AdditionRequest, DocumentRequest, ProjectRequest, PhoneChangeRequest, PaginatedResponse } from '@/types'

export type { ServiceRequest, AdditionRequest, DocumentRequest, ProjectRequest, PhoneChangeRequest }

interface ListParams {
  status?: string
  search?: string
  cabinet_id?: number
  request_type?: string
  resolved_by_admin_id?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
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

  getProjectRequests: async (params?: ListParams) => {
    const { data } = await apiClient.get<PaginatedResponse<ProjectRequest>>('/admin/project-requests', { params })
    return data
  },

  approveProjectRequest: async (id: number, admin_response: string | null) => {
    const { data } = await apiClient.post(`/admin/project-requests/${id}/approve`, { admin_response })
    return data
  },

  rejectProjectRequest: async (id: number, admin_response: string) => {
    const { data } = await apiClient.post(`/admin/project-requests/${id}/reject`, { admin_response })
    return data
  },

  // Смена номера телефона. Просмотр — оператору, решение — только админу.
  // Одобрение меняет номер (то есть логин) немедленно, поэтому владение номером
  // администратор обязан подтвердить вне системы — сама она этого не умеет.
  getPhoneChangeRequests: async (params?: ListParams) => {
    const { data } = await apiClient.get<PaginatedResponse<PhoneChangeRequest>>('/admin/phone-change-requests', { params })
    return data
  },

  approvePhoneChangeRequest: async (id: number, admin_response: string | null) => {
    const { data } = await apiClient.post(`/admin/phone-change-requests/${id}/approve`, { admin_response })
    return data
  },

  rejectPhoneChangeRequest: async (id: number, admin_response: string) => {
    const { data } = await apiClient.post(`/admin/phone-change-requests/${id}/reject`, { admin_response })
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
