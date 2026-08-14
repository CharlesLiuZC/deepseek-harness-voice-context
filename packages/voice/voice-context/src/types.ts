/**
 * Pure wire types of the voice-context domain: the payload vocabulary the
 * Remote boundary carries. Free of host-side imports so both the Host service
 * and the Client aggregate can name them through the `./client` projection.
 * @module @deepseek-ai/dsh-voice-context/types
 */

/** One transcription request crossing the Remote boundary. */
export interface TranscribeRequest {
  /** Base64-encoded audio bytes (the browser records WAV). */
  readonly audio: string
  /** Container MIME type of the encoded audio, e.g. `audio/wav`. */
  readonly mimeType: string
  /** Optional BCP-47 language hint; the service default applies when omitted. */
  readonly language?: string
}

/** One transcription result returned across the Remote boundary. */
export interface TranscribeResult {
  /** The transcribed text. */
  readonly text: string
}
