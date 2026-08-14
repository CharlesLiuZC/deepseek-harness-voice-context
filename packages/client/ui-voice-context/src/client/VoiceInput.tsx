/**
 * VoiceInput: the mic button contributed to the `conversation.input.left`
 * slot. It records an utterance, encodes it to base64, and transcribes it
 * through the injected `transcribe` Remote face, then appends the transcript
 * to the composer draft via `inputActions.setDraft`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TranscribeRequest } from '@deepseek-ai/dsh-voice-context/client'
import { VoiceRecorder } from './recorder.ts'

/** Outcome of one transcription, mapped from the Remote result. */
export type TranscribeOutcome =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: string }

/** The injected face the mic button consumes. */
export interface VoiceInputInjected {
  transcribe: (request: TranscribeRequest) => Promise<TranscribeOutcome>
}

/** Full props of the input.left entry: InputZone + session standard kit + injected face. */
type VoiceInputProps = PropsRuntime<'conversation.input.left'> & VoiceInputInjected

type Phase = 'idle' | 'recording' | 'transcribing' | 'error'

/** Append a transcript to the current draft, joining on a single space. */
function appendTranscript(draft: string, text: string): string {
  const trimmed = text.trim()
  if (trimmed === '') return draft
  return draft === '' ? trimmed : `${draft} ${trimmed}`
}

/** Encode a Blob as base64 for the Remote payload. */
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

// One-time style injection for the recording pulse / spinner rotation.
if (typeof document !== 'undefined' && document.querySelector('style[data-vc]') === null) {
  const style = document.createElement('style')
  style.setAttribute('data-vc', 'dsh-voice-context')
  style.textContent = '@keyframes vc-spin{to{transform:rotate(360deg)}}'
  document.head.appendChild(style)
}

export function VoiceInput({ input, inputActions, transcribe }: VoiceInputProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<VoiceRecorder | null>(null)

  const zh = typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
  const label = zh ? '语音输入' : 'Voice input'
  const recording = phase === 'recording'

  useEffect(() => () => { recorderRef.current?.abort() }, [])

  const toggle = useCallback(async () => {
    if (phase === 'transcribing') return
    if (phase === 'recording') {
      const recorder = recorderRef.current
      recorderRef.current = null
      setPhase('transcribing')
      setError(null)
      try {
        if (recorder === null) throw new Error('recorder not started')
        const wav = await recorder.stop()
        const outcome = await transcribe({
          audio: await blobToBase64(wav),
          mimeType: 'audio/wav',
          ...(zh ? { language: 'zh' } : {}),
        })
        if (!outcome.ok) throw new Error(outcome.error)
        inputActions.setDraft(appendTranscript(input.draft, outcome.text))
        setPhase('idle')
      } catch (err) {
        setPhase('error')
        setError(err instanceof Error ? err.message : String(err))
      }
      return
    }

    setPhase('idle')
    setError(null)
    try {
      const recorder = new VoiceRecorder()
      await recorder.start()
      recorderRef.current = recorder
      setPhase('recording')
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [phase, input.draft, inputActions, transcribe, zh])

  const title = phase === 'error' && error !== null ? `${label}: ${error}` : label

  return (
    <button
      type="button"
      className="vc-mic"
      aria-label={label}
      aria-pressed={recording}
      title={title}
      data-phase={phase}
      onClick={() => { void toggle() }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        padding: 0,
        border: 0,
        background: 'transparent',
        color: recording ? '#e5484d' : phase === 'error' ? '#b8860b' : 'currentColor',
        cursor: phase === 'transcribing' ? 'default' : 'pointer',
        opacity: phase === 'transcribing' ? 0.6 : 1,
      }}
    >
      {phase === 'recording' ? <StopIcon /> : phase === 'transcribing' ? <Spinner /> : <MicIcon />}
    </button>
  )
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      style={{ animation: 'vc-spin 0.8s linear infinite' }}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  )
}
