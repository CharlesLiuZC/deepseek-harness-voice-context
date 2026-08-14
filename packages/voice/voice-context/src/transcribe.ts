/**
 * Transcription forwarder: decode the Remote's base64 audio and forward it to
 * the OpenAI-compatible `/v1/audio/transcriptions` endpoint, resolving the API
 * credential per request through the credentials seam (then literal config,
 * then the process environment). Loopback backends are forwarded unauthenticated.
 * @module @deepseek-ai/dsh-voice-context/transcribe
 */

import type { Context } from '@deepseek-ai/cordis'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { ResolvedConfig } from './config.ts'
import type { TranscribeRequest, TranscribeResult } from './types.ts'

const CLOUD_BASE_URL = 'https://api.siliconflow.cn'
const CLOUD_MODEL = 'FunAudioLLM/SenseVoiceSmall'
const LOCAL_MODEL_IDS = new Set(['iic/SenseVoiceSmall', 'small', 'medium', 'large-v3'])

/** Resolve the API key for one request: credentials seam → literal → environment. */
async function resolveApiKey(ctx: Context, config: ResolvedConfig): Promise<string | undefined> {
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    const resolved = await credentials.resolve(credentialRef(config.apiKeyEnv))
    if (resolved !== undefined) return resolved.value
  }
  if (config.apiKey !== '') return config.apiKey
  const ambient = process.env[config.apiKeyEnv]
  return ambient !== undefined && ambient !== '' ? ambient : undefined
}

/** Whether the configured base URL points at the loopback interface. */
function isLoopback(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname
    return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
  } catch {
    return false
  }
}

/** Resolve the trusted upstream route for one browser-selected backend. */
function resolveTarget(config: ResolvedConfig, request: TranscribeRequest): { baseUrl: string; model: string } {
  if (request.backend === 'local') {
    const model = request.model ?? 'iic/SenseVoiceSmall'
    if (!LOCAL_MODEL_IDS.has(model)) throw new Error(`voice-context: invalid local STT model ${model}`)
    return { baseUrl: `http://127.0.0.1:${config.localPort}`, model }
  }
  if (request.backend === 'cloud') {
    const model = request.model ?? CLOUD_MODEL
    if (model !== CLOUD_MODEL) throw new Error(`voice-context: invalid cloud STT model ${model}`)
    return {
      baseUrl: isLoopback(config.baseUrl) ? CLOUD_BASE_URL : config.baseUrl,
      model,
    }
  }
  return { baseUrl: config.baseUrl, model: config.model }
}

/** Upstream filename extension from a container MIME type. */
function filenameFor(mimeType: string): string {
  if (mimeType.includes('webm')) return 'audio.webm'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'audio.m4a'
  if (mimeType.includes('ogg') || mimeType.includes('opus')) return 'audio.ogg'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'audio.mp3'
  return 'audio.wav'
}

/** Extract the transcript string from an upstream JSON body. */
function extractText(parsed: unknown): string {
  if (parsed !== null && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (typeof record.result === 'string') return record.result
    if (Array.isArray(record.segments)) {
      const joined = record.segments
        .map(segment => (segment !== null && typeof segment === 'object'
          ? (segment as Record<string, unknown>).text
          : undefined))
        .filter((text): text is string => typeof text === 'string')
        .join('')
      if (joined !== '') return joined
    }
  }
  return ''
}

/**
 * Forward one transcription request to the configured provider.
 * @param ctx - owning context supplying the credentials plane.
 * @param config - resolved service configuration.
 * @param request - base64 audio plus its container and optional language hint.
 * @returns the transcribed text.
 * @throws when no credential is configured for a cloud backend, or upstream fails.
 */
export async function transcribeAudio(
  ctx: Context,
  config: ResolvedConfig,
  request: TranscribeRequest,
): Promise<TranscribeResult> {
  const target = resolveTarget(config, request)
  const apiKey = isLoopback(target.baseUrl) ? undefined : await resolveApiKey(ctx, config)
  if (apiKey === undefined && !isLoopback(target.baseUrl)) {
    throw new Error(`voice-context: no STT credential configured (set ${config.apiKeyEnv} in settings)`)
  }

  const audio = Buffer.from(request.audio, 'base64')
  if (audio.length === 0) throw new Error('voice-context: empty audio payload')
  if (audio.length > config.maxBytes) throw new Error('voice-context: audio payload exceeds maxBytes')

  const form = new FormData()
  form.append('model', target.model)
  form.append('language', request.language ?? config.language)
  form.append('file', new Blob([audio], { type: request.mimeType }), filenameFor(request.mimeType))

  const headers: Record<string, string> = {}
  if (apiKey !== undefined) headers.authorization = `Bearer ${apiKey}`

  const upstream = await fetch(`${target.baseUrl.replace(/\/+$/, '')}/v1/audio/transcriptions`, {
    method: 'POST',
    headers,
    body: form,
    signal: AbortSignal.timeout(config.timeoutMs),
  })

  const raw = await upstream.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = undefined
  }

  if (!upstream.ok) {
    const message = parsed !== null && typeof parsed === 'object'
      && 'error' in (parsed as Record<string, unknown>)
      ? String((parsed as Record<string, unknown>).error)
      : `upstream STT failed (${upstream.status})`
    throw new Error(`voice-context: ${message}`)
  }

  return { text: extractText(parsed) }
}
