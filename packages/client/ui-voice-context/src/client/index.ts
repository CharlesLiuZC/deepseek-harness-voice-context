/**
 * Voice-Context Web surface, browser half.
 *
 * Two contributions:
 *  - a mic button in the composer's `conversation.input.left` tool row, which
 *    records an utterance and transcribes it through the `voiceContext` Remote
 *    (crossing the `/api` browser-trust fence);
 *  - a `settings.section` page where the user types the STT API key, written
 *    through the credentials domain and resolved by the Host per request.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the ui-conversation SlotMap merge (the `conversation.input.left` declaration).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the ui-settings SlotMap merge (the `settings.section` entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the `remote` Context merge plus the `remote.voiceContext` namespace.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { TranscribeRequest, TranscribeResult } from '@deepseek-ai/dsh-voice-context/client'
import { VoiceInput, type VoiceInputInjected } from './VoiceInput.tsx'
import { VoiceSettingsSection, type VoiceSettingsInjected } from './VoiceSettings.tsx'

/** The browser services this plugin consumes. */
export const inject = ['slots', 'connection', 'remote', 'remote.voiceContext']

/**
 * Client plugin body: contribute the mic control and the settings page.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const voiceContext = ctx.remote.voiceContext

  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'voice-context',
    order: 100,
    inject: (): VoiceInputInjected => ({
      transcribe: async (request: TranscribeRequest) => {
        const result = await voiceContext.transcribe(request)
        if (!result.ok) return { ok: false, error: result.error.message }
        return { ok: true, text: result.value.text }
      },
    }),
  }, VoiceInput))

  const { api } = ctx.get('connection') as ConnectionHandle
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'voice-context',
    order: 40,
    label: () => (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
      ? '语音输入'
      : 'Voice input'),
    inject: (): VoiceSettingsInjected => ({ api }),
  }, VoiceSettingsSection))
}

export type { TranscribeRequest, TranscribeResult }
