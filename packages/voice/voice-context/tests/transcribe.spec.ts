import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { transcribeAudio } from '../src/transcribe.ts'
import type { ResolvedConfig } from '../src/config.ts'

/** Fully-defaulted cloud configuration for the tests. */
function cloudConfig(): ResolvedConfig {
  return {
    apiKey: 'sk-test',
    apiKeyEnv: 'SILICONFLOW_API_KEY',
    baseUrl: 'https://api.siliconflow.cn',
    model: 'FunAudioLLM/SenseVoiceSmall',
    language: 'zh',
    maxBytes: 25 * 1024 * 1024,
    timeoutMs: 60000,
    localPort: 8080,
    pythonBin: 'python',
  }
}

describe('transcribeAudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('forwards base64 audio to the provider and returns the transcript', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: '你好' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await transcribeAudio(new Context(), cloudConfig(), {
      audio: Buffer.from('hi').toString('base64'),
      mimeType: 'audio/wav',
    })

    expect(result.text).toBe('你好')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.siliconflow.cn/v1/audio/transcriptions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test')
    expect(init.body).toBeInstanceOf(FormData)
  })

  it('resolves the credential through the credentials seam when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = new Context()
    vi.spyOn(ctx, 'get').mockImplementation((key: string) => key === 'credentials'
      ? { resolve: async () => ({ value: 'from-credential', source: 'env' }) }
      : undefined)

    await transcribeAudio(ctx, { ...cloudConfig(), apiKey: '' }, { audio: 'aGk=', mimeType: 'audio/wav' })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer from-credential')
  })

  it('throws for a cloud backend when no credential is configured', async () => {
    vi.stubEnv('SILICONFLOW_API_KEY', '')
    await expect(transcribeAudio(new Context(), { ...cloudConfig(), apiKey: '' }, {
      audio: 'aGk=',
      mimeType: 'audio/wav',
    })).rejects.toThrow('no STT credential configured')
  })

  it('forwards a loopback backend without an Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'local' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await transcribeAudio(new Context(), {
      ...cloudConfig(),
      apiKey: '',
      baseUrl: 'http://127.0.0.1:8080',
    }, { audio: 'aGk=', mimeType: 'audio/wav' })

    expect(result.text).toBe('local')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).authorization).toBeUndefined()
  })

  it('routes an explicit local model to the managed loopback port', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'local medium' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await transcribeAudio(new Context(), { ...cloudConfig(), localPort: 8000 }, {
      audio: 'aGk=',
      mimeType: 'audio/wav',
      backend: 'local',
      model: 'medium',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:8000/v1/audio/transcriptions')
    expect((init.headers as Record<string, string>).authorization).toBeUndefined()
    expect((init.body as FormData).get('model')).toBe('medium')
  })

  it('routes an explicit cloud request away from a configured loopback backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'cloud' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await transcribeAudio(new Context(), {
      ...cloudConfig(),
      baseUrl: 'http://127.0.0.1:8000',
    }, {
      audio: 'aGk=',
      mimeType: 'audio/wav',
      backend: 'cloud',
      model: 'FunAudioLLM/SenseVoiceSmall',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.siliconflow.cn/v1/audio/transcriptions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test')
  })

  it('rejects a local-only model on the cloud route', async () => {
    await expect(transcribeAudio(new Context(), cloudConfig(), {
      audio: 'aGk=',
      mimeType: 'audio/wav',
      backend: 'cloud',
      model: 'small',
    })).rejects.toThrow('invalid cloud STT model')
  })

  it('throws when the provider answers an error status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'bad model' }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(transcribeAudio(new Context(), cloudConfig(), {
      audio: 'aGk=',
      mimeType: 'audio/wav',
    })).rejects.toThrow('bad model')
  })
})
