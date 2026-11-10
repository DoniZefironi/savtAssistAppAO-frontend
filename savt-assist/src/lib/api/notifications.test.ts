import { describe, expect, it } from 'vitest'
import { isUrgentNotification, urgentChatId } from './notifications'

describe('isUrgentNotification', () => {
  it('срочное: operator_requested с заголовком на «СРОЧНО»', () => {
    expect(isUrgentNotification({ type: 'operator_requested', title: 'СРОЧНО: возможна опасная ситуация' })).toBe(true)
  })

  it('не зависит от регистра и пробелов в начале', () => {
    expect(isUrgentNotification({ type: 'operator_requested', title: '  срочно: проверка' })).toBe(true)
  })

  it('обычный запрос оператора не срочный', () => {
    expect(isUrgentNotification({ type: 'operator_requested', title: 'Пользователь просит оператора' })).toBe(false)
  })

  it('другой тип уведомления с «СРОЧНО» в заголовке не считается срочным чатом', () => {
    expect(isUrgentNotification({ type: 'promotional', title: 'СРОЧНО: акция' })).toBe(false)
  })

  it('слово «срочно» не в начале заголовка не считается', () => {
    expect(isUrgentNotification({ type: 'operator_requested', title: 'Запрос, срочно' })).toBe(false)
  })
})

describe('urgentChatId', () => {
  it('достаёт номер чата из текста', () => {
    expect(urgentChatId({ body: 'Пользователь сообщает об опасной ситуации в чате #42. Откройте чат как можно скорее' })).toBe(42)
  })

  it('без номера возвращает null', () => {
    expect(urgentChatId({ body: 'Откройте чат как можно скорее' })).toBeNull()
  })

  it('решётка без цифр — null', () => {
    expect(urgentChatId({ body: 'чат # без номера' })).toBeNull()
  })

  it('при нескольких номерах берёт первый', () => {
    expect(urgentChatId({ body: 'чат #7, ранее #3' })).toBe(7)
  })
})
