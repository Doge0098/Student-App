import { describe, expect, it } from 'vitest'
import { backupFileName, clearData, createBackup, parseBackup, restoreBackup } from './backup'

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  }
}

const now = new Date(2026, 9, 5, 18, 30)

describe('copia de seguridad', () => {
  it('copia solo los datos de LockIn, sin temporizador ni claves de IA', () => {
    const storage = fakeStorage({
      'student-app:tasks': JSON.stringify([{ id: '1', text: 'Mates' }]),
      'student-app:timer': JSON.stringify({ phase: 'focus' }),
      'student-app:ai-settings': JSON.stringify({ key: 'secreta' }),
      'otra-web:algo': '1',
    })
    const backup = createBackup(storage, now)
    expect(backup.app).toBe('LockIn')
    expect(Object.keys(backup.data)).toEqual(['tasks'])
    expect(JSON.stringify(backup)).not.toContain('secreta')
  })

  it('vuelve a cargar una copia sustituyendo los datos actuales', () => {
    const origin = fakeStorage({ 'student-app:tasks': '[1]', 'student-app:notes': '[2]' })
    const text = JSON.stringify(createBackup(origin, now))
    const target = fakeStorage({ 'student-app:tasks': '["viejo"]', 'student-app:my-apps': '["x"]', 'otra-web:algo': '1' })
    expect(restoreBackup(target, parseBackup(text))).toBe(2)
    expect(target.map.get('student-app:tasks')).toBe('[1]')
    expect(target.map.has('student-app:my-apps')).toBe(false)
    expect(target.map.get('otra-web:algo')).toBe('1')
  })

  it('rechaza archivos que no son copias de LockIn', () => {
    expect(() => parseBackup('hola')).toThrow(/no es una copia/)
    expect(() => parseBackup('{"app":"Otra","version":1,"data":{}}')).toThrow(/no es una copia/)
    expect(() => parseBackup('{"app":"LockIn","version":9,"data":{}}')).toThrow(/versión/)
  })

  it('no escribe claves raras al cargar', () => {
    const target = fakeStorage()
    restoreBackup(target, { app: 'LockIn', version: 1, exportedAt: '', data: { '../x': 1, ok: 2 } })
    expect([...target.map.keys()]).toEqual(['student-app:ok'])
  })

  it('borra los datos de LockIn pero no las claves de IA', () => {
    const storage = fakeStorage({ 'student-app:tasks': '[]', 'student-app:ai-settings': '{}', 'otra-web:algo': '1' })
    clearData(storage)
    expect([...storage.map.keys()].sort()).toEqual(['otra-web:algo', 'student-app:ai-settings'])
  })

  it('pone fecha al nombre del archivo', () => {
    expect(backupFileName(now)).toBe('lockin-copia-2026-10-05.json')
  })

  it('rechaza copias con apartados de forma rara sin tocar los datos', () => {
    expect(() => parseBackup('{"app":"LockIn","version":1,"data":{"tasks":{}}}')).toThrow(/dañada/)
    expect(() => parseBackup('{"app":"LockIn","version":1,"data":{"profile":null}}')).toThrow(/dañada/)
  })

  it('si no cabe, deja los datos como estaban', () => {
    const storage = fakeStorage({ 'student-app:tasks': '["mía"]' })
    const setItem = storage.setItem
    storage.setItem = (k: string, v: string) => {
      if (k === 'student-app:notes') throw new Error('QuotaExceededError')
      setItem(k, v)
    }
    const backup = { app: 'LockIn' as const, version: 1 as const, exportedAt: '', data: { tasks: [], notes: ['enorme'] } }
    expect(() => restoreBackup(storage, backup)).toThrow(/demasiado grande/)
    expect(storage.map.get('student-app:tasks')).toBe('["mía"]')
  })

  it('borrar todo también puede borrar las claves de IA', () => {
    const storage = fakeStorage({ 'student-app:tasks': '[]', 'student-app:ai-settings': '{}' })
    clearData(storage, { keepSecrets: false })
    expect(storage.map.size).toBe(0)
  })
})
