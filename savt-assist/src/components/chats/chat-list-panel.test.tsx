import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Chat } from '@/types'

const urgent = new Set<number>()
vi.mock('@/lib/hooks/use-urgent-chats', () => ({ useUrgentChatIds: () => urgent }))

import { ChatListPanel } from './chat-list-panel'

function chat(over: Partial<Chat> & { id: number }): Chat {
  return {
    chat_type: 'support', cabinet_id: null, cabinet_name: null,
    last_message_text: null, last_message_at: null, unread_count: 0,
    problem_status: null, bot_active: true, operator_requested: false,
    ...over,
  }
}

function render(chats: Chat[], over: { compact?: boolean; archived?: boolean; loading?: boolean } = {}): string {
  const noop = () => {}
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ChatListPanel
        chats={chats} selectedId={null} onSelect={noop} onSelectChatId={noop}
        loading={over.loading ?? false} compact={over.compact} archived={over.archived}
        searchValue="" onSearchChange={noop}
      />
    </QueryClientProvider>,
  )
}

describe('ChatListPanel', () => {
  it('пустой список: «Нет чатов», в архиве — «В архиве пусто»', () => {
    expect(render([])).toContain('Нет чатов')
    expect(render([], { archived: true })).toContain('В архиве пусто')
  })

  it('показывает названия, текст последнего сообщения и счётчик непрочитанных', () => {
    const html = render([chat({ id: 1, user_name: 'Иван', last_message_text: 'Не работает насос', unread_count: 3 })])
    expect(html).toContain('Поддержка — Иван')
    expect(html).toContain('Не работает насос')
    expect(html).toContain('>3<')
  })

  it('непрочитанных больше 99 — «99+»', () => {
    expect(render([chat({ id: 1, unread_count: 150 })])).toContain('99+')
  })

  it('чат, ждущий оператора, жёлтый и без пометки «Срочно»', () => {
    const html = render([chat({ id: 1, operator_requested: true })])
    expect(html).toContain('bg-amber-50')
    expect(html).not.toContain('Срочно')
    expect(html).not.toContain('bg-red-50')
  })

  it('срочный чат красный, с пометкой «Срочно»', () => {
    urgent.clear(); urgent.add(1)
    const html = render([chat({ id: 1, operator_requested: true })])
    expect(html).toContain('bg-red-50')
    expect(html).toContain('Срочно')
    expect(html).not.toContain('bg-amber-50')
    urgent.clear()
  })

  it('срочное уведомление по чату, который оператор уже взял, красным его не делает', () => {
    urgent.clear(); urgent.add(1)
    const html = render([chat({ id: 1, operator_requested: false })])
    expect(html).not.toContain('Срочно')
    expect(html).not.toContain('bg-red-50')
    urgent.clear()
  })

  it('срочный чат стоит в списке выше обычного ждущего', () => {
    urgent.clear(); urgent.add(2)
    const html = render([
      chat({ id: 1, user_name: 'Первый', operator_requested: true }),
      chat({ id: 2, user_name: 'Второй', operator_requested: true }),
    ])
    expect(html.indexOf('Второй')).toBeLessThan(html.indexOf('Первый'))
    urgent.clear()
  })

  it('компактный режим: срочный — красная точка, обычный ждущий — жёлтая', () => {
    urgent.clear(); urgent.add(2)
    const html = render([
      chat({ id: 1, operator_requested: true }),
      chat({ id: 2, operator_requested: true }),
    ], { compact: true })
    expect(html).toContain('bg-red-500')
    expect(html).toContain('bg-amber-500')
    urgent.clear()
  })
})
