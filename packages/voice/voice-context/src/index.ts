/**
 * Voice-context service: a Typert Remote-exposed speech-to-text capability.
 *
 * The `transcribe` Remote crosses the `/api` browser-trust fence like every
 * first-party Remote; audio travels as base64 JSON, the credential resolves
 * through the credentials seam per call, and loopback backends skip auth. The
 * `/voice-local` command (optional, mounted only when a command adapter exists)
 * manages the local offline backend.
 * @module @deepseek-ai/dsh-voice-context
 */

import { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation } from '@deepseek-ai/dsh-commands'
import z from '@deepseek-ai/schemastery'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import { resolveConfig, type ResolvedConfig, type VoiceContextConfig } from './config.ts'
import { transcribeAudio } from './transcribe.ts'
import { LocalSttManager } from './local.ts'
import type { TranscribeRequest, TranscribeResult } from './types.ts'

// The pure payload outlet re-exported onto the package root keeps the module
// edge in the emitted index.d.ts, so client aggregates can name the wire types.
export type * from './types.ts'

export const name = 'voice-context'

/** Loader schema for the Voice-Context service. */
export const Config: z<VoiceContextConfig> = z.object({
  apiKey: z.string().role('secret'),
  apiKeyEnv: z.string().role('credential-ref').default('SILICONFLOW_API_KEY'),
  baseUrl: z.string().default('https://api.siliconflow.cn'),
  model: z.string().default('FunAudioLLM/SenseVoiceSmall'),
  language: z.string().default('zh'),
  maxBytes: z.natural().default(25 * 1024 * 1024),
  timeoutMs: z.natural().default(60000),
  localPort: z.natural().max(65535).default(8000),
  pythonBin: z.string().default('python'),
})

/** Speech-to-text service (`ctx.voiceContext`) exposed through Typert Gateway. */
export class VoiceContextService extends TypertRemoteService {
  static inject: string[] = []

  static Config = Config

  private readonly resolved: ResolvedConfig
  private readonly local: LocalSttManager

  constructor(ctx: Context, config: VoiceContextConfig = {}) {
    super(ctx, 'voiceContext')
    this.resolved = resolveConfig(config)
    this.local = new LocalSttManager(this.resolved)

    // The local-backend command is an optional capability: it mounts only when
    // a command adapter exists, without blocking the Remote service elsewhere.
    ctx.inject(['commands'], (cmdCtx) => {
      cmdCtx.commands.register({
        name: 'voice-local',
        description: 'manage the local offline speech-to-text backend',
        input: { hint: '[status|install|start|stop]' },
        handler: (invocation: CommandInvocation) => this.local.run(invocation.rawInput, invocation.signal),
      })
    })
  }

  /**
   * Transcribe one audio payload through the configured STT provider.
   * @param request - audio container plus optional language, backend, and model choices.
   * @returns the transcribed text.
   */
  @Remote('transcribe')
  async transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
    return await transcribeAudio(this.ctx, this.resolved, request)
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    voiceContext: VoiceContextService
  }
}

export default VoiceContextService
