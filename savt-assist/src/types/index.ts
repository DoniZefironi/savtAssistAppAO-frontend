export type UserRole = 'superadmin' | 'admin' | 'operator' | 'user'

export interface User {
  id: number
  login: string | null
  // Подтверждённый номер из Telegram, он же логин. Пользователь его не меняет —
  // только через заявку с одобрением админа (см. admin: phone change requests).
  phone: string | null
  // Рабочий номер для связи. НЕ подтверждён, на вход не влияет, меняется
  // пользователем свободно — полагаться на него при идентификации нельзя.
  contact_phone?: string | null
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
  project_id?: number | null
  project_name?: string | null
  created_at: string
}

export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired' | 'none'

// Контактное лицо заказчика из сделки Bitrix. Только в админских ответах —
// в GET /projects/{id} их нет (персональные данные, а доступ к проекту по QR).
export interface ProjectContact {
  id: number
  full_name: string
  post: string | null
  phones: string[]
  emails: string[]
}

export interface Project {
  id: number
  name: string
  unique_code: string
  cabinet_count: number
  created_at: string
  production_number?: string | null
  // Год по тому же правилу, что и годовая папка на NAS: из производственного
  // номера (26_170 → 2026), у заведённых вручную — по дате создания
  year?: number | null
  company_name?: string | null
  shipment_planned_at?: string | null
  shipment_actual_at?: string | null
  warranty_ends_at?: string | null
  // Считается по гарантии самого проекта, а не его шкафов
  warranty_status?: WarrantyStatus | null
}

export interface ProjectDetail {
  id: number
  name: string
  unique_code: string
  parent_project_id: number | null
  folder_synced_at: string | null
  cabinets: { id: number; type: string | null; object_number: string; admin_internal_name: string | null }[]
  created_at: string
  updated_at: string
  // Из сделки Bitrix — только для чтения: перезаписываются на каждом изменении
  // сделки, PATCH их не принимает (см. README-backend.md, «Поля сделки в карточке проекта»)
  production_number?: string | null
  shipment_planned_at?: string | null
  shipment_actual_at?: string | null
  company_name?: string | null
  contacts?: ProjectContact[]
  // Наше, редактируется админом: в CRM гарантии нет
  warranty_starts_at?: string | null
  warranty_ends_at?: string | null
  warranty_status?: WarrantyStatus | null
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
  chat_type: 'cabinet' | 'project' | 'support' | 'notes' | 'service_request'
  cabinet_id: number | null
  cabinet_name: string | null
  // Чат проекта в целом — отдельный от чатов ШУ, заполнен вместо cabinet_*
  project_id?: number | null
  project_name?: string | null
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
  service_request_id?: number | null
  service_request_type?: string | null
  service_request_status?: 'open' | 'in_progress' | 'closed' | null
  service_request_description?: string | null
  service_request_created_at?: string | null
  archived_at?: string | null
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
  attachments: ChatAttachment[]
  reactions: { emoji: string; user_id: number }[]
}

// Вложение, приходящее с сервера (в составе сообщения или из /attachments) —
// либо файл (file_url/file_name/mime_type/... заполнены), либо геолокация
// (latitude/longitude заполнены, остальное null), см. attachment_type.
export interface ChatAttachment {
  id: number
  message_id: number
  attachment_type: 'image' | 'voice' | 'document' | 'video' | 'location' | string
  file_url: string | null
  file_name: string | null
  mime_type: string | null
  file_size_bytes: number | null
  duration_seconds: number | null
  latitude: number | null
  longitude: number | null
  created_at: string
}

export interface MessageFileAttachment {
  file_url: string
  file_name: string
  file_size_bytes: number
  mime_type: string
  duration_seconds: number | null
}

export interface MessageLocationAttachment {
  latitude: number
  longitude: number
}

// Вложение при отправке нового сообщения — либо файл, либо геолокация,
// смешивать поля одного вложения нельзя (см. README-backend.md).
export type MessageAttachment = MessageFileAttachment | MessageLocationAttachment

export function isLocationAttachment(a: MessageAttachment): a is MessageLocationAttachment {
  return 'latitude' in a
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
  chat_id: number | null
  created_at: string
  closed_at: string | null
  bitrix_task_id: string | null
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
  resolved_by_admin_id: number | null
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
  project_id: number | null
  doc_type: string
  status: 'pending' | 'approved' | 'rejected'
  user_message: string | null
  admin_response: string | null
  resolved_by_admin_id: number | null
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
  resolved_by_admin_id: number | null
  created_at: string
  resolved_at: string | null
}

// Заявка на смену номера телефона. Самостоятельной смены больше нет: номер —
// это логин, а подтвердить владение им система не может (SMS отключены), поэтому
// решение принимает администратор вне системы. См. README-backend.md,
// «admin: phone change requests».
export interface PhoneChangeRequest {
  id: number
  user_id: number
  new_phone: string
  old_phone: string | null
  user_comment: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  admin_response: string | null
  resolved_by_admin_id: number | null
  created_at: string
  resolved_at: string | null
  user_full_name: string | null
  user_type: 'individual' | 'organization' | null
  organization_name: string | null
  user_is_verified: boolean
  user_registered_at: string | null
  // Сколько всего необработанных заявок на ЭТОТ ЖЕ номер, включая текущую.
  // > 1 — на номер претендует несколько аккаунтов, одобрять не разобравшись нельзя.
  pending_rivals: number
}

export interface ProjectRequest {
  id: number
  user_id: number
  user_full_name: string | null
  user_phone: string | null
  user_type: 'individual' | 'organization' | null
  organization_name: string | null
  user_is_verified: boolean
  user_registered_at: string | null
  project_id: number
  project_name: string
  user_comment: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_response: string | null
  resolved_by_admin_id: number | null
  created_at: string
  resolved_at: string | null
}
