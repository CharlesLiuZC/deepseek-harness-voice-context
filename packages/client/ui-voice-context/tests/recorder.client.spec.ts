import { afterEach, describe, expect, it, vi } from 'vitest'
import { VoiceRecorder } from '../src/client/recorder.ts'

describe('VoiceRecorder', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports unsupported when the environment lacks mediaDevices', () => {
    vi.stubGlobal('navigator', {})
    expect(new VoiceRecorder().supported).toBe(false)
  })

  it('reports supported when getUserMedia is available', () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } })
    expect(new VoiceRecorder().supported).toBe(true)
  })

  it('rejects start() without a secure recording context', async () => {
    vi.stubGlobal('navigator', {})
    await expect(new VoiceRecorder().start()).rejects.toThrow('secure context')
  })

  it('rejects stop() before recording starts', async () => {
    await expect(new VoiceRecorder().stop()).rejects.toThrow('not recording')
  })

  it('treats abort() before start as a no-op', () => {
    const recorder = new VoiceRecorder()
    expect(() => recorder.abort()).not.toThrow()
  })
})
