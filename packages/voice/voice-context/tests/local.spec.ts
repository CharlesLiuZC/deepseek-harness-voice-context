import { afterEach, describe, expect, it, vi } from 'vitest'

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void
type ExecFileMock = (command: string, args: readonly string[], options: object, callback: ExecFileCallback) => void

const { execFileMock, spawnMock } = vi.hoisted(() => ({
  execFileMock: vi.fn<ExecFileMock>(),
  spawnMock: vi.fn(),
}))

vi.mock('node:child_process', () => ({ execFile: execFileMock, spawn: spawnMock }))
vi.mock('node:os', () => ({
  cpus: vi.fn(() => [{ model: 'core-a' }, { model: 'core-b' }]),
  totalmem: vi.fn(() => 16 * 2 ** 30),
}))

import { LocalSttManager } from '../src/local.ts'
import type { ResolvedConfig } from '../src/config.ts'

function config(): ResolvedConfig {
  return {
    apiKey: '',
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

/** One execFile answer keyed by the first argument, mirroring the check() probes. */
function mockChecks(map: Record<string, { ok: boolean; output: string }>): void {
  execFileMock.mockImplementation((_command, args, _opts, callback) => {
    const key = args[0] ?? ''
    const answer = map[key] ?? { ok: true, output: '' }
    callback(answer.ok ? null : new Error('probe failed'), answer.output, '')
  })
}

describe('LocalSttManager.run', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    execFileMock.mockReset()
    spawnMock.mockReset()
  })

  it('rejects an unknown subcommand with usage text', async () => {
    const manager = new LocalSttManager(config())
    const result = await manager.run('bogus', new AbortController().signal)
    expect(result).toEqual({ kind: 'error', text: 'Usage: /voice-local [status|install|start|stop]' })
  })

  it('reports hardware, tooling, and server state from status', async () => {
    mockChecks({
      '--version': { ok: true, output: 'Python 3.12.8\n' },
      '--query-gpu=name': { ok: false, output: 'nvidia-smi not found' },
      '-c': { ok: true, output: '' },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })))

    const result = await new LocalSttManager(config()).run('status', new AbortController().signal)

    expect(result.kind).toBe('success')
    expect(result.text).toContain('Python: Python 3.12.8')
    expect(result.text).toContain('GPU: none detected')
    expect(result.text).toContain('CPU cores: 2')
    expect(result.text).toContain('RAM: 16.0 GiB')
    expect(result.text).toContain('FunASR: installed')
    expect(result.text).toContain('Local server: running on 127.0.0.1:8080')
  })

  it('returns an error when install is attempted without Python', async () => {
    mockChecks({ '--version': { ok: false, output: 'not found' } })
    const result = await new LocalSttManager(config()).run('install', new AbortController().signal)
    expect(result.kind).toBe('error')
    expect(result.text).toContain('Python not found')
  })

  it('reports a healthy server as already running on start', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })))
    const result = await new LocalSttManager(config()).run('start', new AbortController().signal)
    expect(result).toEqual({ kind: 'success', text: 'Local server already running on 127.0.0.1:8080.' })
  })

  it('reports no tracked server on stop', async () => {
    const result = await new LocalSttManager(config()).run('stop', new AbortController().signal)
    expect(result).toEqual({ kind: 'success', text: 'No local server is tracked by this process.' })
  })
})
