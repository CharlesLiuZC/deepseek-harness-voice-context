/**
 * Local backend manager: detect whether the host can run a local STT model,
 * install the FunASR requirements, launch the local SenseVoiceSmall server as
 * a tracked child process, and report status. The `/voice-local` command (see
 * index.ts) is the human-facing surface.
 * @module @deepseek-ai/dsh-voice-context/local
 */

import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { cpus, totalmem } from 'node:os'
import { fileURLToPath } from 'node:url'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import type { ResolvedConfig } from './config.ts'

/** Absolute path of the shipped FunASR backend directory (next to `lib/`). */
const LOCAL_DIR = fileURLToPath(new URL('../local/funasr/', import.meta.url))

/** One short-lived process check (version probe, import probe, GPU probe). */
interface CheckResult {
  ok: boolean
  output: string
}

function check(command: string, args: string[], timeoutMs = 20000): Promise<CheckResult> {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: 'utf8', timeout: timeoutMs }, (error, stdout, stderr) => {
      resolve({ ok: error === null, output: `${stdout}\n${stderr}`.trim() })
    })
  })
}

/** Whether the local STT server answers `/health` on the configured port. */
async function serverHealthy(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) })
    return response.ok
  } catch {
    return false
  }
}

/** Poll `/health` until it answers or the deadline passes (model load can take seconds). */
async function waitHealthy(port: number, timeoutMs = 30000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await serverHealthy(port)) return true
    await new Promise((resolve) => { setTimeout(resolve, 1000) })
  }
  return false
}

/**
 * Owns the local backend's lifecycle. The launched server is a child of this
 * dsh process, so it stops with the harness unless `stop` is called first.
 */
export class LocalSttManager {
  private child: ChildProcess | undefined

  constructor(private readonly config: ResolvedConfig) {}

  /** Report hardware capability and local-backend readiness as UI text. */
  async status(): Promise<CommandResult> {
    const lines: string[] = []

    const python = await check(this.config.pythonBin, ['--version'])
    lines.push(python.ok
      ? `Python: ${python.output.split('\n')[0]}`
      : `Python: not found (tried "${this.config.pythonBin}")`)

    const gpu = await check('nvidia-smi', ['--query-gpu=name', '--format=csv,noheader'], 5000)
    lines.push(gpu.ok ? `GPU: ${gpu.output.split('\n')[0] ?? 'detected'}` : 'GPU: none detected (CPU mode is fine for SenseVoiceSmall)')

    lines.push(`CPU cores: ${cpus().length}`)
    lines.push(`RAM: ${(totalmem() / 2 ** 30).toFixed(1)} GiB`)

    if (python.ok) {
      const funasr = await check(this.config.pythonBin, ['-c', 'import funasr'])
      lines.push(funasr.ok
        ? 'FunASR: installed'
        : 'FunASR: not installed — run /voice-local install')
    }

    lines.push(await serverHealthy(this.config.localPort)
      ? `Local server: running on 127.0.0.1:${this.config.localPort}`
      : `Local server: not running — run /voice-local start`)

    return { kind: 'success', text: lines.join('\n') }
  }

  /** Install the FunASR requirements into the active Python environment. */
  async install(signal: AbortSignal): Promise<CommandResult> {
    const python = await check(this.config.pythonBin, ['--version'])
    if (!python.ok) {
      return { kind: 'error', text: `Python not found (tried "${this.config.pythonBin}"); install Python 3.9+ or set pythonBin in config.` }
    }
    const output = await runInstall(this.config.pythonBin, `${LOCAL_DIR}requirements.txt`, signal)
    if (!output.ok) {
      return { kind: 'error', text: `pip install failed:\n${output.output}` }
    }
    return { kind: 'success', text: `Installed FunASR requirements. Run /voice-local start, then point baseUrl at http://127.0.0.1:${this.config.localPort}.` }
  }

  /** Launch the local server as a tracked child process. */
  async start(): Promise<CommandResult> {
    if (await serverHealthy(this.config.localPort)) {
      return { kind: 'success', text: `Local server already running on 127.0.0.1:${this.config.localPort}.` }
    }
    if (this.child !== undefined) {
      return { kind: 'error', text: 'A local server launch is already tracked; run /voice-local stop first.' }
    }
    const child = spawn(
      this.config.pythonBin,
      ['-m', 'uvicorn', 'server:app', '--host', '127.0.0.1', '--port', String(this.config.localPort)],
      { cwd: LOCAL_DIR, stdio: 'ignore', detached: false },
    )
    this.child = child
    child.once('error', () => { this.child = undefined })
    child.once('exit', () => { this.child = undefined })

    const running = await waitHealthy(this.config.localPort)
    return running
      ? { kind: 'success', text: `Local SenseVoiceSmall server started on 127.0.0.1:${this.config.localPort}. Point baseUrl at it.` }
      : { kind: 'error', text: `Server launched but /health is not answering on 127.0.0.1:${this.config.localPort}; check the uvicorn output.` }
  }

  /** Stop the tracked local server. */
  async stop(): Promise<CommandResult> {
    if (this.child === undefined) {
      return { kind: 'success', text: 'No local server is tracked by this process.' }
    }
    this.child.kill()
    this.child = undefined
    return { kind: 'success', text: 'Stopped the local server.' }
  }

  /** Dispatch one parsed `/voice-local` invocation to its subcommand. */
  async run(rawInput: string, signal: AbortSignal): Promise<CommandResult> {
    switch (rawInput.trim().toLowerCase()) {
      case '':
      case 'status':
        return await this.status()
      case 'install':
        return await this.install(signal)
      case 'start':
        return await this.start()
      case 'stop':
        return await this.stop()
      default:
        return { kind: 'error', text: 'Usage: /voice-local [status|install|start|stop]' }
    }
  }
}

/** Run `python -m pip install -r <requirement>` and capture its output. */
function runInstall(python: string, requirement: string, signal: AbortSignal): Promise<CheckResult> {
  return new Promise((resolve) => {
    execFile(
      python,
      ['-m', 'pip', 'install', '-r', requirement],
      { encoding: 'utf8', timeout: 30 * 60 * 1000, signal, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({ ok: error === null, output: `${stdout}\n${stderr}`.trim() })
      },
    )
  })
}
