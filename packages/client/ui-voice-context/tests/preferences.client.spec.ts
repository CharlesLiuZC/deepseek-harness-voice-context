import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_VOICE_PREFERENCE,
  hasSavedVoicePreference,
  loadVoicePreference,
  saveVoicePreference,
  VOICE_PREFERENCE_KEY,
} from '../src/client/preferences.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => { values.clear() },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
}

describe('voice preference', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('defaults to local SenseVoiceSmall before first-time configuration', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(loadVoicePreference()).toEqual(DEFAULT_VOICE_PREFERENCE)
    expect(hasSavedVoicePreference()).toBe(false)
  })

  it('persists a selectable local Whisper size', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    saveVoicePreference({ backend: 'local', model: 'large-v3' })
    expect(storage.getItem(VOICE_PREFERENCE_KEY)).toContain('large-v3')
    expect(loadVoicePreference()).toEqual({ backend: 'local', model: 'large-v3' })
    expect(hasSavedVoicePreference()).toBe(true)
  })

  it('rejects invalid cloud/model pairs instead of persisting arbitrary ids', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(() => { saveVoicePreference({ backend: 'cloud', model: 'small' }) }).toThrow('invalid voice preference')
  })

  it('falls back safely when stored JSON is untrusted', () => {
    const storage = memoryStorage()
    storage.setItem(VOICE_PREFERENCE_KEY, JSON.stringify({ backend: 'local', model: '../../model' }))
    vi.stubGlobal('localStorage', storage)
    expect(loadVoicePreference()).toEqual(DEFAULT_VOICE_PREFERENCE)
  })
})
