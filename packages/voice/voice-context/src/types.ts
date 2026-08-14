/**
 * Pure wire types of the voice-context domain: the payload vocabulary the
 * Remote boundary carries. Free of host-side imports so both the Host service
 * and the Client aggregate can name them through the `./client` projection.
 * @module @deepseek-ai/dsh-voice-context/types
 */

/** Selectable transcription backend exposed by the Web settings surface. */
export type TranscriptionBackend = 'cloud' | 'local'

/** Cloud model currently supported by the bundled SiliconFlow integration. */
export type CloudTranscriptionModel = 'FunAudioLLM/SenseVoiceSmall'

/** Models installed by the companion local STT server. */
export type LocalTranscriptionModel = 'iic/SenseVoiceSmall' | 'small' | 'medium' | 'large-v3'

/** Model ids the first-party Voice-Context UI can send. */
export type TranscriptionModel = CloudTranscriptionModel | LocalTranscriptionModel

/** One transcription request crossing the Remote boundary. */
export interface TranscribeRequest {
  /** Base64-encoded audio bytes (the browser records WAV). */
  readonly audio: string
  /** Container MIME type of the encoded audio, e.g. `audio/wav`. */
  readonly mimeType: string
  /** Optional BCP-47 language hint; the service default applies when omitted. */
  readonly language?: string
  /** Per-request cloud or loopback routing choice; configured routing applies when omitted. */
  readonly backend?: TranscriptionBackend
  /** Model selected for the chosen backend; configured model applies when omitted. */
  readonly model?: TranscriptionModel
}

/** One transcription result returned across the Remote boundary. */
export interface TranscribeResult {
  /** The transcribed text. */
  readonly text: string
}
