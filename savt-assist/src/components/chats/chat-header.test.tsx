import { describe, expect, it } from 'vitest'
import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MessageCircle } from 'lucide-react'
import { ChatHeader } from './chat-header'

type Props = Parameters<typeof ChatHeader>[0]

function render(over: Partial<Props> = {}): string {
  const noop = () => {}
  const props: Props = {
    searchOpen: false, searchInput: '', onSearchInputChange: noop, onToggleSearch: noop,
    name: 'Поддержка — Иван', avatarBg: 'bg-sky-500', AvatarIcon: MessageCircle,
    botActive: true, operatorRequested: false,
    onAvatarClick: noop, onTake: noop, takePending: false, onReturnToBot: noop, returnToBotPending: false,
    headerMenuOpen: false, onToggleHeaderMenu: noop, headerMenuRef: createRef<HTMLDivElement>(),
    pinnedCount: 0, onJumpToPinned: noop, onUnpinAll: noop, onClearHistory: noop, onDeleteChat: noop,
    canDeleteChat: false,
    ...over,
  }
  return renderToStaticMarkup(<ChatHeader {...props} />)
}

describe('ChatHeader: кто отвечает', () => {
  it('отвечает бот: статус «Бот отвечает» и кнопка «Взять чат»', () => {
    const html = render({ botActive: true })
    expect(html).toContain('Бот отвечает')
    expect(html).toContain('Взять чат')
    expect(html).not.toContain('Оператор отвечает')
    expect(html).not.toContain('Вернуть боту')
  })

  it('отвечает оператор: статус «Оператор отвечает» и кнопка «Вернуть боту»', () => {
    const html = render({ botActive: false })
    expect(html).toContain('Оператор отвечает')
    expect(html).toContain('Вернуть боту')
    expect(html).not.toContain('Бот отвечает')
    expect(html).not.toContain('Взять чат')
  })

  it('чат сервисной заявки: бота нет вообще, ни статуса, ни кнопок', () => {
    const html = render({ hideBotControls: true })
    expect(html).not.toContain('Бот отвечает')
    expect(html).not.toContain('Оператор отвечает')
    expect(html).not.toContain('Взять чат')
    expect(html).not.toContain('Вернуть боту')
  })

  it('идёт запрос «Взять чат» — на кнопке многоточие', () => {
    expect(render({ takePending: true })).toContain('>...<')
  })
})

describe('ChatHeader: ожидание оператора', () => {
  it('без запроса оператора плашки нет', () => {
    expect(render()).not.toContain('Ожидает оператора')
  })

  it('обычный запрос оператора — жёлтая плашка «Ожидает оператора»', () => {
    const html = render({ operatorRequested: true })
    expect(html).toContain('Ожидает оператора')
    expect(html).toContain('bg-amber-100')
    expect(html).not.toContain('СРОЧНО')
  })

  it('срочный — красная плашка «СРОЧНО: ожидает оператора»', () => {
    const html = render({ operatorRequested: true, urgent: true })
    expect(html).toContain('СРОЧНО: ожидает оператора')
    expect(html).toContain('bg-red-100')
    expect(html).not.toContain('bg-amber-100')
  })

  it('urgent без operatorRequested плашку не показывает', () => {
    expect(render({ urgent: true })).not.toContain('СРОЧНО')
  })
})

describe('ChatHeader: меню', () => {
  it('«Очистить историю» и «Удалить чат» только у администратора', () => {
    expect(render({ headerMenuOpen: true, canDeleteChat: false })).not.toContain('Удалить чат')
    const html = render({ headerMenuOpen: true, canDeleteChat: true })
    expect(html).toContain('Очистить историю')
    expect(html).toContain('Удалить чат')
  })

  it('«Открепить все» появляется со второго закрепа', () => {
    expect(render({ headerMenuOpen: true, pinnedCount: 1 })).not.toContain('Открепить все')
    expect(render({ headerMenuOpen: true, pinnedCount: 2 })).toContain('Открепить все (2)')
  })
})
