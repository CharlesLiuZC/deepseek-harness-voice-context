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
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import { Config, resolveConfig, type ResolvedConfig } from './config.ts'
import type { Config as ConfigType } from './config.ts'
import { transcribeAudio } from './transcribe.ts'
import { LocalSttManager } from './local.ts'
import type { TranscribeRequest, TranscribeResult } from './types.ts'

// The pure payload outlet re-exported onto the package root keeps the module
// edge in the emitted index.d.ts, so client aggregates can name the wire types.
export type * from './types.ts'

export const name = 'voice-context'

/** Speech-to-text service (`ctx.voiceContext`) exposed through Typert Gateway. */
export class VoiceContextService extends TypertRemoteService {
  static inject: string[] = []

  static Config = Config

  private readonly resolved: ResolvedConfig
  private readonly local: LocalSttManager

  constructor(ctx: Context, config: ConfigType = {}) {
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
   * @param request - base64 audio, its container, and optional language hint.
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
