import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { HttpError, apiErrorMessage, apiFieldErrors, httpErrorFromResponse } from './errors'

function axiosErr(status: number, data: unknown): AxiosError {
  const err = new AxiosError('fail')
  err.response = { status, data, statusText: '', headers: {}, config: {} as never }
  return err
}

describe('apiErrorMessage', () => {
  it('строка detail показывается как есть (в том числе 409 при одобрении заявки)', () => {
    expect(apiErrorMessage(axiosErr(409, { detail: 'Номер уже зарегистрирован' }), 'fb')).toBe('Номер уже зарегистрирован')
  })

  it('422: массив pydantic не показывается, вместо него общий текст', () => {
    const detail = [{ loc: ['body', 'title'], msg: 'String should have at most 255 characters', type: 'string_too_long' }]
    expect(apiErrorMessage(axiosErr(422, { detail }), 'fb')).toBe('Проверьте поля формы')
  })

  it('413: HTML-страница вместо JSON — «Слишком большой запрос», тело не разбирается', () => {
    expect(apiErrorMessage(axiosErr(413, '<html><body>413 Request Entity Too Large</body></html>'), 'fb')).toBe('Слишком большой запрос')
  })

  it('413 с JSON detail тоже даёт единый текст', () => {
    expect(apiErrorMessage(axiosErr(413, { detail: 'file too big' }), 'fb')).toBe('Слишком большой запрос')
  })

  it('429: отдельный текст про паузу', () => {
    expect(apiErrorMessage(axiosErr(429, { detail: 'x' }), 'fb')).toMatch('Слишком много попыток')
  })

  it.each([502, 503, 504])('%i: JSON с текстом сервера показывается как есть', (status) => {
    expect(apiErrorMessage(axiosErr(status, { detail: 'Сервис временно недоступен, попробуйте ещё раз через минуту' }), 'fb'))
      .toBe('Сервис временно недоступен, попробуйте ещё раз через минуту')
  })

  it.each([502, 503, 504])('%i: HTML от nginx — всё равно понятный текст', (status) => {
    expect(apiErrorMessage(axiosErr(status, '<html>Bad Gateway</html>'), 'fb')).toMatch('Сервис временно недоступен')
  })

  it('нет ответа вообще — «Нет связи с сервером»', () => {
    expect(apiErrorMessage(new AxiosError('Network Error'), 'fb')).toBe('Нет связи с сервером')
  })

  it('прочие ошибки — запасной текст', () => {
    expect(apiErrorMessage(axiosErr(500, { detail: '' }), 'fb')).toBe('fb')
    expect(apiErrorMessage(new Error('boom'), 'fb')).toBe('fb')
  })
})

describe('HttpError (ошибки загрузок через fetch)', () => {
  const resp = (status: number, body: string, type: string) =>
    new Response(body, { status, headers: { 'content-type': type } })

  it('JSON detail сохраняется и показывается', async () => {
    const err = await httpErrorFromResponse(resp(415, JSON.stringify({ detail: 'Недопустимый формат' }), 'application/json'))
    expect(err).toBeInstanceOf(HttpError)
    expect(apiErrorMessage(err, 'fb')).toBe('Недопустимый формат')
  })

  it('413 от nginx (HTML): тело не парсится, текст про размер', async () => {
    const err = await httpErrorFromResponse(resp(413, '<html>413</html>', 'text/html'))
    expect(err.detail).toBeUndefined()
    expect(apiErrorMessage(err, 'fb')).toBe('Слишком большой запрос')
  })

  it('503 с HTML — текст про недоступность сервиса', async () => {
    const err = await httpErrorFromResponse(resp(503, '<html>503</html>', 'text/html'))
    expect(apiErrorMessage(err, 'fb')).toMatch('Сервис временно недоступен')
  })

  it('битый JSON не роняет разбор', async () => {
    const err = await httpErrorFromResponse(resp(500, '{oops', 'application/json'))
    expect(apiErrorMessage(err, 'fb')).toBe('fb')
  })
})

describe('apiFieldErrors', () => {
  it('раскладывает 422 по именам полей (последний элемент loc)', () => {
    const err = axiosErr(422, {
      detail: [
        { loc: ['body', 'title'], msg: 'слишком длинное', type: 'string_too_long' },
        { loc: ['body', 'phone'], msg: 'неверный формат', type: 'value_error' },
      ],
    })
    expect(apiFieldErrors(err)).toEqual({ title: 'слишком длинное', phone: 'неверный формат' })
  })

  it('при нескольких ошибках одного поля берётся первая', () => {
    const err = axiosErr(422, { detail: [
      { loc: ['body', 'title'], msg: 'первая' },
      { loc: ['body', 'title'], msg: 'вторая' },
    ] })
    expect(apiFieldErrors(err)).toEqual({ title: 'первая' })
  })

  it('не 422 и не axios — пусто', () => {
    expect(apiFieldErrors(axiosErr(409, { detail: 'x' }))).toEqual({})
    expect(apiFieldErrors(new Error('x'))).toEqual({})
  })

  it('элементы без loc пропускаются', () => {
    expect(apiFieldErrors(axiosErr(422, { detail: [{ msg: 'без loc' }, null] }))).toEqual({})
  })
})
