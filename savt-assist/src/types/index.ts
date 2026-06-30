export type UserRole = 'superadmin' | 'admin' | 'operator' | 'user'

export interface User {
  id: number
  login: string | null
  phone: string | null
  full_name: string | null
  email: string | null
  role: UserRole
  is_active: boolean
  is_phone_verified: boolean
  created_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
}

export interface Cabinet {
  id: number
  unique_code: string
  type: string | null
  object_number: string
  admin_internal_name: string | null
  admin_comment: string | null
  description: string | null
  purpose: string | null
  warranty_status: 'active' | 'expiring_soon' | 'expired' | null
  warranty_starts_at: string | null
  warranty_ends_at: string | null
  latitude: number | null
  longitude: number | null
  tags?: { id: number; name: string; scope: string }[]
  created_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface Chat {
  id: number
  chat_type: 'cabinet' | 'support' | 'notes'
  cabinet_id: number | null
  cabinet_name: string | null
  user_name?: string | null
  user_full_name?: string | null
  user_phone?: string | null
  user_id?: number | null
  last_message_text: string | null
  last_message_at: string | null
  unread_count: number
  problem_status: string | null
  bot_active: boolean
  operator_requested: boolean
}

export interface ChatMessage {
  id: number
  chat_id: number
  sender_id: number
  sender_name: string
  text: string | null
  reply_to_message_id: number | null
  is_read: boolean
  created_at: string
  edited_at: string | null
  deleted_at: string | null
  attachments: MessageAttachment[]
  reactions: { emoji: string; user_id: number }[]
}

export interface ChatAttachment {
  id: number
  message_id: number
  file_url: string
  file_name: string
  mime_type: string
  file_size_bytes: number
  duration_seconds: number | null
  created_at: string
  attachment_type: string
}

export interface MessageAttachment {
  file_url: string
  file_name: string
  file_size_bytes: number
  mime_type: string
  duration_seconds: number | null
}

export interface DashboardStats {
  totalCabinets: number
  openServiceRequests: number
  pendingCabinetRequests: number
  totalUsers: number
}

export interface ServiceRequest {
  id: number
  user_id: number
  user_full_name: string | null
  user_phone: string | null
  user_type: 'individual' | 'organization' | null
  organization_name: string | null
  user_is_verified: boolean
  user_registered_at: string | null
  cabinet_id: number
  cabinet_object_number: string
  request_type: string
  description: string
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
  closed_at: string | null
}

export interface AdditionRequest {
  id: number
  user_id: number
  user_full_name: string | null
  user_phone: string | null
  user_type: 'individual' | 'organization' | null
  organization_name: string | null
  user_is_verified: boolean
  user_registered_at: string | null
  photo_url: string
  user_comment: string | null
  status: 'pending' | 'approved' | 'rejected'
  cabinet_id: number | null
  admin_response: string | null
  created_at: string
  resolved_at: string | null
}

export interface DocumentRequest {
  id: number
  user_id: number
  user_full_name: string | null
  user_phone: string | null
  user_type: 'individual' | 'organization' | null
  organization_name: string | null
  user_is_verified: boolean
  user_registered_at: string | null
  document_id: number | null
  cabinet_id: number | null
  doc_type: string
  status: 'pending' | 'approved' | 'rejected'
  user_message: string | null
  admin_response: string | null
  created_at: string
  resolved_at: string | null
}

export interface ShareRequest {
  id: number
  user_id: number
  user_full_name: string | null
  user_phone: string | null
  user_type: 'individual' | 'organization' | null
  organization_name: string | null
  user_is_verified: boolean
  user_registered_at: string | null
  cabinet_id: number
  cabinet_type: string
  cabinet_object_number: string
  user_comment: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_response: string | null
  created_at: string
  resolved_at: string | null
}
