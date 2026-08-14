/**
 * Browser microphone capture: records through MediaRecorder, decodes the
 * compressed container, and re-encodes a 16 kHz mono 16-bit PCM WAV — the one
 * container every ASR backend accepts, without shipping any audio library.
 */

/** Pick the first MediaRecorder MIME type this browser actually supports. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate
    } catch {
      // isTypeSupported can throw on some engines; fall through to the next.
    }
  }
  return undefined
}

/** Decode a compressed container into a 16 kHz mono Float32 array. */
async function decodeToMono16k(arrayBuffer: ArrayBuffer): Promise<Float32Array> {
  const context = new AudioContext()
  try {
    const audio = await context.decodeAudioData(arrayBuffer)
    const inRate = audio.sampleRate
    const inLength = audio.length
    const outLength = Math.max(1, Math.round(inLength * (16000 / inRate)))
    const out = new Float32Array(outLength)
    for (let i = 0; i < outLength; i++) {
      const position = i * (inRate / 16000)
      const i0 = Math.floor(position)
      const i1 = Math.min(i0 + 1, inLength - 1)
      const fraction = position - i0
      let mono = 0
      for (let channel = 0; channel < audio.numberOfChannels; channel++) {
        const data = audio.getChannelData(channel)
        const s0 = data[i0] ?? 0
        const s1 = data[i1] ?? 0
        mono += s0 + (s1 - s0) * fraction
      }
      out[i] = mono / audio.numberOfChannels
    }
    return out
  } finally {
    await context.close()
  }
}

/** Write a 16-bit PCM WAV header plus samples into an ArrayBuffer. */
function encodeWav(samples: Float32Array): ArrayBuffer {
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 16000, true)
  view.setUint32(28, 16000 * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataBytes, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += 2
  }
  return buffer
}

/** One recording session producing a 16 kHz mono WAV Blob on stop. */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | undefined
  private stream: MediaStream | undefined
  private chunks: Blob[] = []

  /** Whether the environment can record at all (secure context + getUserMedia). */
  get supported(): boolean {
    return typeof navigator !== 'undefined'
      && typeof navigator.mediaDevices !== 'undefined'
      && typeof navigator.mediaDevices.getUserMedia === 'function'
  }

  /** Request the microphone and start recording. */
  async start(): Promise<void> {
    if (!this.supported) {
      throw new Error('microphone access requires a secure context (https or localhost)')
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.chunks = []
    const mimeType = pickMimeType()
    this.mediaRecorder = new MediaRecorder(this.stream, mimeType === undefined ? undefined : { mimeType })
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    }
    this.mediaRecorder.start()
  }

  /** Stop recording and resolve to a 16 kHz mono WAV Blob. */
  stop(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const recorder = this.mediaRecorder
      if (recorder === undefined) {
        reject(new Error('not recording'))
        return
      }
      recorder.onstop = () => {
        this.releaseStream()
        const mimeType = recorder.mimeType || 'audio/webm'
        const container = new Blob(this.chunks, { type: mimeType })
        this.chunks = []
        container.arrayBuffer()
          .then((buffer) => decodeToMono16k(buffer))
          .then((samples) => new Blob([encodeWav(samples)], { type: 'audio/wav' }))
          .then(resolve, reject)
      }
      recorder.onerror = () => {
        this.releaseStream()
        reject(new Error('audio recording failed'))
      }
      recorder.stop()
    })
  }

  /** Stop capturing without producing audio (component unmount while recording). */
  abort(): void {
    if (this.mediaRecorder !== undefined && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null
      this.mediaRecorder.onerror = null
      this.mediaRecorder.stop()
    }
    this.releaseStream()
    this.chunks = []
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((track) => { track.stop() })
    this.stream = undefined
  }
}
