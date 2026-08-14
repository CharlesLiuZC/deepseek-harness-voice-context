/**
 * Voice-context service configuration. The credential (`apiKeyEnv`) is a
 * reference resolved through the credentials seam per request, so a key typed
 * in the Web settings page is live without a restart; `apiKey` is a literal
 * fallback for non-interactive deployments.
 * @module @deepseek-ai/dsh-voice-context/config
 */

import z from '@deepseek-ai/schemastery'

export interface Config {
  /** Literal STT bearer token; prefer {@link apiKeyEnv}. */
  apiKey?: string
  /** Credential reference name resolved through the credentials seam each call. */
  apiKeyEnv?: string
  /** OpenAI-compatible provider origin, e.g. `https://api.siliconflow.cn`. */
  baseUrl?: string
  /** Provider model id, e.g. `FunAudioLLM/SenseVoiceSmall`. */
  model?: string
  /** BCP-47 language hint sent upstream. */
  language?: string
  /** Hard cap on the accepted audio payload in bytes. */
  maxBytes?: number
  /** Upstream request timeout in milliseconds. */
  timeoutMs?: number
  /** Port the local STT server (see `/voice-local`) listens on. */
  localPort?: number
  /** Python interpreter used to install and launch the local backend. */
  pythonBin?: string
}

export const Config: z<Config> = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default('SILICONFLOW_API_KEY'),
  baseUrl: z.string().default('https://api.siliconflow.cn'),
  model: z.string().default('FunAudioLLM/SenseVoiceSmall'),
  language: z.string().default('zh'),
  maxBytes: z.natural().default(25 * 1024 * 1024),
  timeoutMs: z.natural().default(60000),
  localPort: z.natural().max(65535).default(8080),
  pythonBin: z.string().default('python'),
})

/** Fully-defaulted configuration consumed by the service. */
export interface ResolvedConfig {
  apiKey: string
  apiKeyEnv: string
  baseUrl: string
  model: string
  language: string
  maxBytes: number
  timeoutMs: number
  localPort: number
  pythonBin: string
}

/** Fill schema defaults over a partial entry config. */
export function resolveConfig(config: Config): ResolvedConfig {
  return {
    apiKey: config.apiKey ?? '',
    apiKeyEnv: config.apiKeyEnv ?? 'SILICONFLOW_API_KEY',
    baseUrl: config.baseUrl ?? 'https://api.siliconflow.cn',
    model: config.model ?? 'FunAudioLLM/SenseVoiceSmall',
    language: config.language ?? 'zh',
    maxBytes: config.maxBytes ?? 25 * 1024 * 1024,
    timeoutMs: config.timeoutMs ?? 60000,
    localPort: config.localPort ?? 8080,
    pythonBin: config.pythonBin ?? 'python',
  }
}
