/**
 * VoiceSettingsSection: the Voice-Context page in the Web settings panel.
 *
 * The API key is written through the credentials domain
 * (`credentials.set`/`credentials.unset`) addressed by the reference the Host
 * service resolves (`SILICONFLOW_API_KEY`). The value never rides a response —
 * the page only learns whether one is configured. Local backend management
 * lives on the `/voice-local` command, which this page points at.
 */
import { useCallback, useEffect, useState } from 'react'
import type { IApiClient } from '@deepseek-ai/dsh-client-connection/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { LocalTranscriptionModel, TranscriptionBackend } from '@deepseek-ai/dsh-voice-context/client'
import {
  hasSavedVoicePreference,
  loadVoicePreference,
  LOCAL_MODELS,
  saveVoicePreference,
  type VoicePreference,
} from './preferences.ts'

/** Credential reference the Host service resolves (see config.ts). */
const KEY_REF = 'SILICONFLOW_API_KEY'

/** The injected face: the credentials subset of the shared API client. */
export interface VoiceSettingsInjected {
  api: Pick<IApiClient, 'credentials'>
}

type VoiceSettingsProps = PropsRuntime<'settings.section'> & VoiceSettingsInjected

function zh(): boolean {
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
}

export function VoiceSettingsSection({ api }: VoiceSettingsProps) {
  const [draft, setDraft] = useState('')
  const [configured, setConfigured] = useState(false)
  const [writable, setWritable] = useState(true)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [preference, setPreference] = useState<VoicePreference>(loadVoicePreference)
  const [preferenceSaved, setPreferenceSaved] = useState(hasSavedVoicePreference)

  const refresh = useCallback(async () => {
    try {
      const response = await api.credentials.describe({ refs: [KEY_REF] })
      if (!response.result.ok) return
      const view = response.result.value.credentials[KEY_REF]
      setConfigured(view?.configured ?? false)
      setWritable(view?.writable ?? true)
    } catch {
      // The page stays usable; the control simply reports its last known state.
    }
  }, [api])

  useEffect(() => { void refresh() }, [refresh])

  const save = useCallback(async () => {
    setPending(true)
    setMessage(null)
    try {
      if (draft.trim() === '') {
        await api.credentials.unset({ ref: KEY_REF })
      } else {
        await api.credentials.set({ ref: KEY_REF, value: draft.trim() })
      }
      setDraft('')
      await refresh()
      setMessage(zh() ? '已保存' : 'Saved')
    } catch {
      setMessage(zh() ? '保存失败' : 'Save failed')
    } finally {
      setPending(false)
    }
  }, [api, draft, refresh])

  const lang = zh()
  const selectBackend = useCallback((backend: TranscriptionBackend) => {
    setPreference({
      backend,
      model: backend === 'cloud' ? 'FunAudioLLM/SenseVoiceSmall' : 'iic/SenseVoiceSmall',
    })
    setPreferenceSaved(false)
    setMessage(null)
  }, [])

  const selectModel = useCallback((model: string) => {
    setPreference(current => ({ ...current, model: model as VoicePreference['model'] }))
    setPreferenceSaved(false)
    setMessage(null)
  }, [])

  const saveRouting = useCallback(() => {
    try {
      saveVoicePreference(preference)
      setPreferenceSaved(true)
      setMessage(lang ? '语音配置已保存' : 'Voice configuration saved')
    } catch {
      setMessage(lang ? '语音配置保存失败' : 'Voice configuration save failed')
    }
  }, [lang, preference])

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px', maxWidth: 520 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
        {lang ? '语音输入（Voice-Context）' : 'Voice-Context'}
      </h2>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
        {lang
          ? '首次使用请选择云端 API 或本地离线模型；麦克风会按此选择逐次转写。'
          : 'For first use, choose the cloud API or a local offline model; the mic uses this choice for every transcription.'}
      </p>

      <fieldset style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 12, border: '1px solid rgba(128,128,128,0.35)', borderRadius: 8 }}>
        <legend style={{ padding: '0 4px', fontSize: 13 }}>{lang ? '处理方式' : 'Processing'}</legend>
        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          {(['local', 'cloud'] as const).map(backend => (
            <label key={backend} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input
                type="radio"
                name="voice-backend"
                value={backend}
                checked={preference.backend === backend}
                onChange={() => { selectBackend(backend) }}
              />
              {backend === 'local'
                ? (lang ? '本地离线' : 'Local offline')
                : (lang ? '云端 API' : 'Cloud API')}
            </label>
          ))}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <span>{lang ? '转写模型' : 'Transcription model'}</span>
          <select
            value={preference.model}
            onChange={(event) => { selectModel(event.target.value) }}
            style={{ padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid rgba(128,128,128,0.4)', background: 'transparent', color: 'inherit' }}
          >
            {preference.backend === 'cloud'
              ? <option value="FunAudioLLM/SenseVoiceSmall">SenseVoiceSmall (SiliconFlow)</option>
              : LOCAL_MODELS.map((model: LocalTranscriptionModel) => (
                <option key={model} value={model}>{model === 'iic/SenseVoiceSmall' ? 'SenseVoiceSmall（中文优先）' : `faster-whisper ${model}`}</option>
              ))}
          </select>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={saveRouting} style={{ padding: '7px 14px', fontSize: 13, borderRadius: 6, border: '1px solid rgba(128,128,128,0.4)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
            {lang ? '保存语音配置' : 'Save voice configuration'}
          </button>
          <span style={{ fontSize: 12, opacity: 0.75 }}>
            {preferenceSaved ? (lang ? '已配置' : 'Configured') : (lang ? '尚未保存' : 'Not saved')}
          </span>
        </div>
      </fieldset>

      {preference.backend === 'cloud' && <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <span>{lang ? 'API Key' : 'API key'}</span>
        <input
          type="password"
          value={draft}
          placeholder={lang ? `配置 ${KEY_REF} 的值` : `value for ${KEY_REF}`}
          disabled={!writable}
          onChange={(event) => { setDraft(event.target.value) }}
          style={{
            padding: '8px 10px',
            fontSize: 13,
            borderRadius: 6,
            border: '1px solid rgba(128,128,128,0.4)',
            background: 'transparent',
            color: 'inherit',
          }}
        />
      </label>}

      {preference.backend === 'cloud' && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => { void save() }}
          disabled={pending || !writable}
          style={{
            padding: '7px 14px',
            fontSize: 13,
            borderRadius: 6,
            border: '1px solid rgba(128,128,128,0.4)',
            background: 'transparent',
            color: 'inherit',
            cursor: pending ? 'default' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}
        >
          {lang ? '保存' : 'Save'}
        </button>
        <span style={{ fontSize: 12, opacity: 0.75 }}>
          {configured
            ? (lang ? '已配置' : 'Configured')
            : (lang ? '未配置' : 'Not configured')}
        </span>
        {message !== null && <span style={{ fontSize: 12, opacity: 0.85 }} role="status">{message}</span>}
      </div>}

      <p style={{ margin: 0, fontSize: 12, opacity: 0.65, lineHeight: 1.6 }}>
        {lang
          ? '本地模型按需切换；首次加载大模型会较慢。服务管理：/voice-local status|install|start|stop。'
          : 'Local models switch on demand; the first large-model load is slower. Manage the service with /voice-local status|install|start|stop.'}
      </p>
    </section>
  )
}
