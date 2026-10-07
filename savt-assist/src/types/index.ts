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
  // Только у ответа /auth/admin-login: true — пароль задан не самим человеком
  // (общий начальный пароль сотрудника из Bitrix), до смены все запросы, кроме
  // /auth/password-change, /auth/logout и /auth/me, дают 403.
  must_change_password?: boolean
}

// Данные о привязанной SIM (внешний сервис — не эта же база) — см.
// README-backend.md, «Рут admin: sim». Живой запрос к стороннему приложению
// на каждый вызов, у нас не хранится и не кэшируется.
export interface SimInfoOut {
  // GUID-строка (так устроено в SimApi), не число.
  id: string
  serial_number: string | null
  phone: string | null
  ip: string | null
  // Ссылка на приложение SimApi — одна и та же для всех SIM, НЕ deep-link на
  // конкретную запись (SimApi не отражает открытую карточку в URL). Нужную
  // SIM там придётся искать вручную после перехода.
  sim_url: string | null
}

export interface Cabinet {
  id: number
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
  // sim_id != null && sim == null — SIM привязана, но внешний сервис с её
  // данными сейчас недоступен. Это НЕ то же самое, что "SIM не привязана"
  // (sim_id == null && sim == null) — см. cabinet-detail-dialog.tsx.
  sim_id?: string | null
  sim?: SimInfoOut | null
  // Топик MQTT-контроллера этого ШУ (напр. "26_001/1/data") — по нему
  // telemetry-proxy сопоставляет входящие сообщения с конкретным ШУ
  // (см. README-backend.md, «Рут admin: telemetry»). Уникален среди ШУ.
  mqtt_topic?: string | null
  // Брокер именно этого ШУ — общего на все объекты нет, у каждого свой
  // хост/порт. telemetry-proxy подключается только когда заполнены все три:
  // mqtt_host, mqtt_port, mqtt_topic (см. GET /webhooks/telemetry/targets).
  mqtt_host?: string | null
  mqtt_port?: number | null
  mqtt_username?: string | null
  // mqtt_password сюда не входит: он write-only (принимается в PATCH, но
  // никогда не возвращается ни в одном ответе) — см. cabinet-detail-dialog.tsx.
  created_at: string
}

export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired' | 'none'

// Стандартная карта регистров, общая для всех ШУ (см. README-backend.md,
// «Рут admin: telemetry»). Каждая строка карты — конкретный бит (0-15)
// конкретного адреса, а не весь регистр целиком.
export interface RegisterDefinition {
  id: number
  address: number
  bit: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

// Добавки/переопределения карты регистров для конкретного ШУ — при
// расшифровке телеметрии проверяются раньше стандартной карты.
export interface RegisterOverride {
  id: number
  cabinet_id: number
  address: number
  bit: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface TelemetryRegister {
  address: number
  bit: number
  // null — адрес/бит не описан ни в стандартной карте, ни в переопределениях
  // этого ШУ; в UI показывать просто по адресу.
  name: string | null
  // Состояние бита — 0/1, не сырое значение регистра.
  value: number
  updated_at: string
}

// Пагинированная лента сырых событий/аварий — история для разбора
// (GET /admin/cabinets/{id}/telemetry/history).
export interface TelemetryEntry {
  id: number
  received_at: string
  registers: TelemetryRegister[]
}

// Текущее состояние карты регистров прямо сейчас — плоский список без
// пагинации, каждый регистр со своим updated_at (GET /admin/cabinets/{id}/telemetry).
export interface TelemetryLiveState {
  registers: TelemetryRegister[]
}

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

// Рекламации — гарантийные/негарантийные претензии, отдельная от сервисных
// заявок сущность (см. README-backend.md, «Рут reclamations»).
export type ReclamationObjectType = 'cabinet' | 'line' | 'component' | 'software' | 'documentation'

// Шесть статусов, соответствуют стадиям смарт-процесса Bitrix ОДИН К ОДНОМУ —
// отдельного поля под стадию нет намеренно, status и есть стадия. Синхронизация
// двусторонняя и полная: подвинули карточку на портале — приедет новый статус
// (поэтому карточку перечитываем при открытии, staleTime: 0).
// Новая заявка заводится в new. Раньше статусов было четыре и review означал
// подачу — теперь подача это new, а review это «специалист уже взял на
// рассмотрение».
export type ReclamationStatus = 'new' | 'review' | 'in_progress' | 'resolved' | 'rejected' | 'invalid'

export interface ReclamationAttachment {
  id: number
  file_url: string
  file_name: string
  file_size_bytes: number
  mime_type: string
  created_at: string
}

// Недоставленная операция синхронизации с Bitrix (GET /admin/reclamations/
// bitrix-outbox). Строка заводится, когда операция упала (портал недоступен,
// сетевой сбой), фоновая задача повторяет её каждые 15 минут, при успехе
// строка исчезает сама. Лимита попыток нет — большое attempts при давнем
// last_attempted_at значит, что застряло всерьёз и нужно разбираться руками.
export interface ReclamationBitrixOutboxItem {
  id: number
  reclamation_id: number
  // Практически всегда create — заявка не доехала до Bitrix при подаче. Остальные
  // виды (status/assignee/deadline/warranty/comment) заводились только из
  // обработки через админку, которой больше нет: новых не появится, но старые,
  // висевшие в очереди на момент перехода, ещё могут встретиться.
  operation: 'create' | 'status' | 'assignee' | 'deadline' | 'warranty' | 'comment'
  // То, с чем именно вызовется Bitrix при повторе (снимок на момент сбоя, не
  // текущее состояние рекламации) — по нему видно причину сбоя напрямую
  // (например, пустой company_id у create). Состав ключей зависит от
  // operation, единой схемы нет — см. README-backend.md, «Рут reclamations».
  payload: Record<string, unknown>
  attempts: number
  last_error: string | null
  created_at: string
  last_attempted_at: string | null
}

// Рекламация, чью карточку удалили в Bitrix (GET /admin/reclamations/
// bitrix-detached). Заявка жива, но с порталом больше не связана и сама туда
// не вернётся — завести карточку заново, закрыть или удалить
// (DELETE /admin/reclamations/{id}, разрешён только для таких), решает админ.
export interface ReclamationBitrixDetachedItem {
  id: number
  status: ReclamationStatus
  description: string
  user_full_name: string | null
  created_at: string
  bitrix_deleted_at: string
}

// Сводка в списке (GET /admin/reclamations) — без вложений и контактов,
// только то, что нужно показать в ленте.
export interface ReclamationListItem {
  id: number
  object_type: ReclamationObjectType
  status: ReclamationStatus
  warranty_classification: boolean | null
  description: string
  // Ровно одно из двух заполнено, как и cabinet_id/project_id при подаче —
  // cabinet_object_number для object_type === 'cabinet', иначе project_name.
  cabinet_object_number: string | null
  project_name: string | null
  created_at: string
  resolved_at: string | null
  user_id: number
  user_full_name: string | null
  // Срок отработки, «ГГГГ-ММ-ДД» без времени. Приезжает из Bitrix вебхуком —
  // карточку перечитываем при каждом открытии (staleTime: 0 у запроса детали),
  // а не держим из кэша.
  deadline_at: string | null
}

// Подробности (GET /admin/reclamations/{id}) — то же, что видит подавший
// рекламацию пользователь, плюс user_id/user_full_name (кто подал — не путать
// с contact_name, это снимок с формы заявки на момент подачи).
export interface ReclamationDetail {
  id: number
  status: ReclamationStatus
  warranty_classification: boolean | null
  object_type: ReclamationObjectType
  cabinet_id: number | null
  cabinet_object_number: string | null
  // Ровно одно из двух заполнено (как и cabinet_id/project_id при подаче) —
  // проект обязателен для всех типов объекта, кроме 'cabinet'.
  project_id: number | null
  project_name: string | null
  // Свободный JSON для всех типов объекта, кроме 'cabinet' — состав зависит
  // от object_type, см. README-backend.md.
  object_details: Record<string, string> | null
  contract_number: string | null
  order_number: string | null
  ttn_number: string | null
  description: string
  occurrence_conditions: string | null
  error_codes: string | null
  contact_name: string
  contact_phone: string
  contact_email: string
  customer_name: string | null
  root_cause: string | null
  resolution_comment: string | null
  // root_cause/resolution_comment/rejection_reason/confirmation_file_* больше
  // никто не пишет (ручки обработки нет, в Bitrix под них нет полей) — остались
  // в схеме только как исторический текст у старых рекламаций, показываем как
  // есть, если заполнено.
  confirmation_file_url: string | null
  confirmation_file_name: string | null
  rejection_reason: string | null
  responsible_name: string | null
  responsible_phone: string | null
  // Приезжает из Bitrix вебхуком (назначают там же), у нас только показывается.
  responsible_bitrix_user_id: number | null
  created_at: string
  resolved_at: string | null
  attachments: ReclamationAttachment[]
  user_id: number
  user_full_name: string | null
  // См. deadline_at у ReclamationListItem выше.
  deadline_at: string | null
  // id карточки на портале, приходит СТРОКОЙ ("57", не числом).
  // Читать вместе с bitrix_deleted_at и pending_create_outbox:
  //   bitrix_deleted_at + пустой item — карточку в Bitrix удалили, рекламация
  //                                     жива, но с порталом больше не связана
  //                                     и сама туда не вернётся;
  //   оба пусты + pending_create_outbox — не доехала до Bitrix вообще;
  //   оба пусты + pending_create_outbox null — обычная задержка, отправка идёт.
  bitrix_item_id: string | null
  bitrix_deleted_at: string | null
  // Застрявшее создание карточки в Bitrix, null — всё доехало или ещё идёт.
  // id отсюда — для PATCH/DELETE /admin/reclamations/bitrix-outbox/{id}.
  pending_create_outbox: ReclamationBitrixOutboxItem | null
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
  service_request_status?: 'open' | 'in_progress' | 'postponed' | 'closed' | null
  service_request_description?: string | null
  service_request_created_at?: string | null
  archived_at?: string | null
  // Личный закреп чата в списке (у каждого — оператора, админа, заявителя —
  // независимо, своя запись в pinned_chats). Не путать с закрепом сообщений
  // внутри чата (ChatPinnedMessage) — это про сам чат в общем списке.
  is_pinned?: boolean
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

export interface ServiceRequest {
  id: number
  user_id: number
  user_full_name: string | null
  user_phone: string | null
  user_type: 'individual' | 'organization' | null
  organization_name: string | null
  user_is_verified: boolean
  user_registered_at: string | null
  // Заявка либо по конкретному ШУ, либо по проекту в целом — ровно одна пара
  // заполнена, вторая всегда null (см. README-backend.md, POST /service-requests).
  cabinet_id: number | null
  cabinet_object_number: string | null
  project_id: number | null
  project_name: string | null
  request_type: string
  description: string
  status: 'open' | 'in_progress' | 'postponed' | 'closed'
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
  // Заявитель уже должен состоять в этом проекте на момент подачи (см.
  // README-backend.md, POST /cabinets/add-by-photo). null — старые заявки,
  // поданные до перехода на проектную модель доступа.
  project_id: number | null
  project_name: string | null
  admin_response: string | null
  resolved_by_admin_id: number | null
  resolved_by_admin_name: string | null
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
  resolved_by_admin_name: string | null
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
  resolved_by_admin_name: string | null
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

// Заявка на регистрацию — аккаунта ещё не существует (в отличие от прочих
// заявок), поэтому вместо user_id/user_phone/... — сырые данные заявителя.
// После approve заводится аккаунт, id которого попадает в created_user_id.
export interface RegistrationRequest {
  id: number
  phone: string
  full_name: string
  user_type: 'individual' | 'organization'
  organization_name: string | null
  contact_phone: string | null
  user_comment: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_response: string | null
  resolved_by_admin_id: number | null
  resolved_by_admin_name: string | null
  created_user_id: number | null
  created_at: string
  resolved_at: string | null
}

// Заявка на сброс пароля — в отличие от регистрации аккаунт уже существует,
// поэтому решение приходит пользователю push-уведомлением в приложении (как
// при смене номера), а не только вне системы. Approve применяет новый пароль
// и отзывает все текущие сессии пользователя.
export interface PasswordResetRequest {
  id: number
  user_id: number
  user_full_name: string | null
  user_phone: string | null
  user_type: 'individual' | 'organization' | null
  organization_name: string | null
  user_is_verified: boolean
  user_registered_at: string | null
  user_comment: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_response: string | null
  resolved_by_admin_id: number | null
  resolved_by_admin_name: string | null
  created_at: string
  resolved_at: string | null
}
