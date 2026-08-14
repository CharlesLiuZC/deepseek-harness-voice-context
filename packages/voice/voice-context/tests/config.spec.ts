import { describe, expect, it } from 'vitest'
import { resolveConfig } from '../src/config.ts'

describe('resolveConfig', () => {
  it('fills every default over an empty entry config', () => {
    expect(resolveConfig({})).toEqual({
      apiKey: '',
      apiKeyEnv: 'SILICONFLOW_API_KEY',
      baseUrl: 'https://api.siliconflow.cn',
      model: 'FunAudioLLM/SenseVoiceSmall',
      language: 'zh',
      maxBytes: 25 * 1024 * 1024,
      timeoutMs: 60000,
      localPort: 8000,
      pythonBin: 'python',
    })
  })

  it('keeps every explicitly supplied field', () => {
    expect(resolveConfig({
      apiKey: 'sk-literal',
      baseUrl: 'http://127.0.0.1:9000',
      model: 'whisper',
      language: 'en',
      localPort: 9000,
      pythonBin: 'python3',
    })).toMatchObject({
      apiKey: 'sk-literal',
      baseUrl: 'http://127.0.0.1:9000',
      model: 'whisper',
      language: 'en',
      localPort: 9000,
      pythonBin: 'python3',
    })
  })
})
