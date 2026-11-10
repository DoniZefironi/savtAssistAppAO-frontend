import { describe, expect, it } from 'vitest'
import { fmtSize, validateAdminDocFile, validateDocFile, validatePhotoFile } from './cabinet-dialog-shared'

const MB = 1024 * 1024

// Реальный File с большим size создавать дорого — подменяем только поле size.
function fakeFile(name: string, size = 1024, type = ''): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('fmtSize', () => {
  it('байты, килобайты, мегабайты', () => {
    expect(fmtSize(500)).toBe('500 B')
    expect(fmtSize(2048)).toBe('2 KB')
    expect(fmtSize(5 * MB)).toBe('5.0 MB')
  })
})

describe('validateAdminDocFile', () => {
  it('пропускает обычные документы любых типов', () => {
    expect(validateAdminDocFile(fakeFile('схема.pdf'))).toBeNull()
    expect(validateAdminDocFile(fakeFile('архив.zip'))).toBeNull()
    expect(validateAdminDocFile(fakeFile('без_расширения'))).toBeNull()
  })

  it.each(['exe', 'msi', 'bat', 'cmd', 'js', 'ps1', 'sh', 'jar', 'apk', 'hta'])('блокирует .%s', (ext) => {
    expect(validateAdminDocFile(fakeFile(`file.${ext}`))).toMatch(`.${ext}`)
  })

  it('регистр расширения не важен', () => {
    expect(validateAdminDocFile(fakeFile('SETUP.EXE'))).not.toBeNull()
  })

  it('смотрит на последнее расширение: .exe.pdf можно, .pdf.exe нельзя', () => {
    expect(validateAdminDocFile(fakeFile('a.exe.pdf'))).toBeNull()
    expect(validateAdminDocFile(fakeFile('a.pdf.exe'))).not.toBeNull()
  })

  it('ровно 500 МБ проходит, больше — нет', () => {
    expect(validateAdminDocFile(fakeFile('v.mp4', 500 * MB))).toBeNull()
    expect(validateAdminDocFile(fakeFile('v.mp4', 500 * MB + 1))).toMatch('слишком большой')
  })
})

describe('validateDocFile (вложения базы знаний)', () => {
  it('допускает pdf и отклоняет неизвестный тип', () => {
    expect(validateDocFile(fakeFile('a.pdf', 1024, 'application/pdf'))).toBeNull()
    expect(validateDocFile(fakeFile('a.zip', 1024, 'application/zip'))).toMatch('Недопустимый формат')
  })
})

describe('validatePhotoFile', () => {
  it('только изображения', () => {
    expect(validatePhotoFile(fakeFile('a.png', 1024, 'image/png'))).toBeNull()
    expect(validatePhotoFile(fakeFile('a.pdf', 1024, 'application/pdf'))).toMatch('изображением')
  })
})
