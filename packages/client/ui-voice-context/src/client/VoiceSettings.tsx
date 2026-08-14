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
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 20px', maxWidth: 520 }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
        {lang ? '语音输入（Voice-Context）' : 'Voice-Context'}
      </h2>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
        {lang
          ? '填入云端语音识别服务的 API Key（如 SiliconFlow），保存后麦克风按钮即可实时转写。'
          : 'Enter the API key for your cloud speech-to-text provider (e.g. SiliconFlow); the mic button transcribes live once saved.'}
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
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
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
      </div>

      <p style={{ margin: 0, fontSize: 12, opacity: 0.65, lineHeight: 1.6 }}>
        {lang
          ? '本地离线部署：在对话输入框运行 /voice-local status|install|start|stop。'
          : 'Offline local backend: run /voice-local status|install|start|stop in the composer.'}
      </p>
    </section>
  )
}
