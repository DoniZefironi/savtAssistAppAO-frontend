import { useQuery } from '@tanstack/react-query'
import { isUrgentNotification, notificationsApi, urgentChatId, type Notification } from '@/lib/api/notifications'

// Уведомление «СРОЧНО» старше суток уже не показатель: чат за это время успели
// взять, а новый обычный запрос оператора не должен подсвечиваться красным.
const URGENT_WINDOW_MS = 24 * 60 * 60 * 1000

const EMPTY = new Set<number>()

export function collectUrgentChatIds(items: Notification[], now: number): Set<number> {
  const ids = new Set<number>()
  for (const n of items) {
    if (!isUrgentNotification(n)) continue
    if (now - new Date(n.created_at).getTime() > URGENT_WINDOW_MS) continue
    const id = urgentChatId(n)
    if (id != null) ids.add(id)
  }
  return ids
}

// Чаты, по которым пришло срочное уведомление. У самого чата признака срочности
// нет (только operator_requested), поэтому берём номер чата из текста уведомления.
// Прочитанные тоже учитываем: прочитать уведомление не значит взять чат. Ключ
// ['notifications', ...] — тот же префикс, что инвалидирует колокольчик.
export function useUrgentChatIds(): Set<number> {
  const { data } = useQuery({
    queryKey: ['notifications', 'urgent'],
    queryFn: () => notificationsApi.getList({ type: ['operator_requested'], size: 50 }),
    refetchInterval: 15_000,
    select: (res) => collectUrgentChatIds(res.items, Date.now()),
  })
  return data ?? EMPTY
}
