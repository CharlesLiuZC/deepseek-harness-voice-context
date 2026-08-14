/**
 * Local backend manager: detect whether the host can run a local STT model,
 * install the FunASR and faster-whisper runtimes, launch the companion server
 * as a tracked child process, and report status. The `/voice-local` command
 * (see index.ts) is the human-facing surface.
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

  /**
   * Report hardware capability and local-backend readiness as UI text.
   * @returns a command result containing the readiness report.
   */
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
      const dependencies = await check(this.config.pythonBin, ['-c', 'import funasr, faster_whisper, torch'])
      lines.push(dependencies.ok
        ? 'Local STT dependencies: installed'
        : 'Local STT dependencies: incomplete — run /voice-local install')
    }

    lines.push(await serverHealthy(this.config.localPort)
      ? `Local server: running on 127.0.0.1:${this.config.localPort}`
      : 'Local server: not running — run /voice-local start')

    return { kind: 'success', text: lines.join('\n') }
  }

  /**
   * Install both local engines and CPU torch into the active Python environment.
   * @param signal - cancellation signal forwarded to pip.
   * @returns the install outcome as a command result.
   */
  async install(signal: AbortSignal): Promise<CommandResult> {
    const python = await check(this.config.pythonBin, ['--version'])
    if (!python.ok) {
      return { kind: 'error', text: `Python not found (tried "${this.config.pythonBin}"); install Python 3.9+ or set pythonBin in config.` }
    }
    const torch = await check(this.config.pythonBin, ['-c', 'import torch, torchaudio'])
    const installs: string[][] = [
      ['-m', 'pip', 'install', '-r', `${LOCAL_DIR}requirements.txt`],
      ['-m', 'pip', 'install', '-r', `${LOCAL_DIR}requirements-faster-whisper.txt`],
    ]
    if (!torch.ok) {
      installs.push([
        '-m', 'pip', 'install', 'torch', 'torchaudio',
        '--index-url', 'https://download.pytorch.org/whl/cpu',
        '--extra-index-url', 'https://pypi.org/simple',
      ])
    }
    for (const args of installs) {
      const output = await runInstall(this.config.pythonBin, args, signal)
      if (!output.ok) {
        return { kind: 'error', text: `pip install failed:\n${output.output}` }
      }
    }
    return { kind: 'success', text: `Installed local STT dependencies. Download any faster-whisper weights you want, then run /voice-local start; the server listens at http://127.0.0.1:${this.config.localPort}.` }
  }

  /**
   * Launch the local server as a tracked child process.
   * @returns the launch outcome as a command result.
   */
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
      ? { kind: 'success', text: `Local STT server started on 127.0.0.1:${this.config.localPort}. Point baseUrl at it.` }
      : { kind: 'error', text: `Server launched but /health is not answering on 127.0.0.1:${this.config.localPort}; check the uvicorn output.` }
  }

  /**
   * Stop the tracked local server.
   * @returns the stop outcome as a command result.
   */
  stop(): Promise<CommandResult> {
    if (this.child === undefined) {
      return Promise.resolve({ kind: 'success', text: 'No local server is tracked by this process.' })
    }
    this.child.kill()
    this.child = undefined
    return Promise.resolve({ kind: 'success', text: 'Stopped the local server.' })
  }

  /**
   * Dispatch one parsed `/voice-local` invocation to its subcommand.
   * @param rawInput - unparsed text after the command name.
   * @param signal - cancellation signal for long-running installation.
   * @returns the selected subcommand outcome.
   */
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

/** Run one pip installation command and capture its output. */
function runInstall(python: string, args: string[], signal: AbortSignal): Promise<CheckResult> {
  return new Promise((resolve) => {
    execFile(
      python,
      args,
      { encoding: 'utf8', timeout: 30 * 60 * 1000, signal, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({ ok: error === null, output: `${stdout}\n${stderr}`.trim() })
      },
    )
  })
}
