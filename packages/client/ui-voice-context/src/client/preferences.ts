/**
 * Browser-local Voice-Context routing preference. The Host still owns every
 * trusted upstream URL; this record contains only controlled backend/model ids.
 */
import type {
  LocalTranscriptionModel,
  TranscriptionBackend,
  TranscriptionModel,
} from '@deepseek-ai/dsh-voice-context/client'

/** Browser storage key for the versioned Voice-Context routing record. */
export const VOICE_PREFERENCE_KEY = 'dsh.voice-context.preference.v1'

/** A validated backend/model pair persisted in this browser. */
export interface VoicePreference {
  readonly backend: TranscriptionBackend
  readonly model: TranscriptionModel
}

/** Local model ids exposed in the first-party settings selector. */
export const LOCAL_MODELS: readonly LocalTranscriptionModel[] = [
  'iic/SenseVoiceSmall',
  'small',
  'medium',
  'large-v3',
]

/** Safe first-use default for a deployment with the companion local server. */
export const DEFAULT_VOICE_PREFERENCE: VoicePreference = {
  backend: 'local',
  model: 'iic/SenseVoiceSmall',
}

/** Return whether the unknown JSON value is one of the controlled choices. */
function isVoicePreference(value: unknown): value is VoicePreference {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  if (candidate.backend === 'cloud') return candidate.model === 'FunAudioLLM/SenseVoiceSmall'
  return candidate.backend === 'local'
    && typeof candidate.model === 'string'
    && LOCAL_MODELS.includes(candidate.model as LocalTranscriptionModel)
}

/**
 * Read the preference, falling back to the production-local default.
 * @returns a validated backend/model pair.
 */
export function loadVoicePreference(): VoicePreference {
  if (typeof localStorage === 'undefined') return DEFAULT_VOICE_PREFERENCE
  try {
    const raw = localStorage.getItem(VOICE_PREFERENCE_KEY)
    if (raw === null) return DEFAULT_VOICE_PREFERENCE
    const parsed: unknown = JSON.parse(raw)
    return isVoicePreference(parsed) ? parsed : DEFAULT_VOICE_PREFERENCE
  } catch {
    return DEFAULT_VOICE_PREFERENCE
  }
}

/**
 * Whether the user has explicitly saved a first-time routing choice.
 * @returns true when the versioned preference record exists.
 */
export function hasSavedVoicePreference(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(VOICE_PREFERENCE_KEY) !== null
}

/**
 * Persist one already-controlled backend/model pair.
 * @param preference - validated cloud or local routing choice.
 */
export function saveVoicePreference(preference: VoicePreference): void {
  if (!isVoicePreference(preference)) throw new Error('invalid voice preference')
  localStorage.setItem(VOICE_PREFERENCE_KEY, JSON.stringify(preference))
}
