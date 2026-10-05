import { Check, ExternalLink, Eye, EyeOff, LoaderCircle, Lock, RotateCcw } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useToast } from '../../components/Toast'
import { useStore } from '../../hooks/store'
import { AiError } from './errors'
import { pickDefaultModel } from './models'
import { PROVIDERS, cleanKey, hasOddCharacters, looksLikeKey, maskKey } from './providers'
import { loadModels, modelListStore, useAiSettings } from './store'
import { PROVIDER_IDS, type ProviderId } from './types'

const CUSTOM = '__custom'

/** Elegir modelo: la lista que da el proveedor con tu clave, o escribir uno a mano. */
function ModelPicker({ provider, apiKey }: { provider: ProviderId; apiKey: string }) {
  const { settings, setModel } = useAiSettings()
  const [lists] = useStore(modelListStore)
  const list = lists[provider]?.key === apiKey ? lists[provider] : undefined
  const models = list?.models ?? []
  const value = settings.models[provider] ?? pickDefaultModel(provider, models) ?? ''
  const [typing, setTyping] = useState(false)
  const custom = typing || (models.length > 0 && !models.some((m) => m.id === value)) || (models.length === 0 && list?.status !== 'loading')
  const selectId = useId()
  const inputId = useId()

  useEffect(() => {
    if (!list) loadModels(provider, apiKey).catch(() => {})
  }, [list, provider, apiKey])

  return (
    <div className="ai-field">
      <label className="ai-label" htmlFor={models.length > 0 ? selectId : inputId}>
        Modelo
      </label>
      {models.length > 0 && (
        <select
          id={selectId}
          value={custom ? CUSTOM : value}
          onChange={(e) => {
            if (e.target.value === CUSTOM) {
              setTyping(true)
            } else {
              setTyping(false)
              setModel(provider, e.target.value)
            }
          }}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          <option value={CUSTOM}>Otro (escribirlo)…</option>
        </select>
      )}
      {list?.status === 'loading' && models.length === 0 && (
        <p className="hint ai-inline">
          <LoaderCircle size={14} className="ai-spin" aria-hidden="true" /> Cargando modelos…
        </p>
      )}
      {custom && (
        <input
          id={inputId}
          type="text"
          spellCheck={false}
          autoComplete="off"
          placeholder="Nombre exacto del modelo"
          aria-label={models.length > 0 ? 'Nombre del modelo' : undefined}
          value={settings.models[provider] ?? ''}
          onChange={(e) => setModel(provider, e.target.value)}
        />
      )}
      {list?.status === 'error' && (
        <div className="ai-inline">
          <p className="error-text">{list.error}</p>
          <button type="button" className="btn-link" onClick={() => loadModels(provider, apiKey, { force: true }).catch(() => {})}>
            <RotateCcw size={13} aria-hidden="true" /> Reintentar
          </button>
        </div>
      )}
    </div>
  )
}

/** Formulario para pegar la clave. Se comprueba pidiendo la lista de modelos antes de guardarla. */
function KeyForm({ provider, onDone, onCancel }: { provider: ProviderId; onDone: () => void; onCancel?: () => void }) {
  const { connect } = useAiSettings()
  const toast = useToast()
  const info = PROVIDERS[provider]
  const [key, setKey] = useState('')
  const [visible, setVisible] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  const cleaned = cleanKey(key)
  const suspicious = cleaned.length > 0 && !looksLikeKey(provider, cleaned)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!cleaned || checking) return
    if (hasOddCharacters(cleaned)) {
      setError(`La clave tiene caracteres raros. Cópiala otra vez desde la web de ${info.name}.`)
      return
    }
    setChecking(true)
    setError(null)
    try {
      const models = await loadModels(provider, cleaned, { force: true })
      connect(provider, cleaned, pickDefaultModel(provider, models))
      toast(`Conectado a ${info.name}.`)
      setKey('')
      onDone()
    } catch (err) {
      // Una clave limitada a usar modelos (sin permiso para listarlos) vale: el modelo se escribe a mano.
      if (
        err instanceof AiError &&
        (err.kind === 'auth' || err.kind === 'forbidden') &&
        /missing scopes|insufficient permissions/i.test(err.detail)
      ) {
        connect(provider, cleaned, undefined)
        toast(`Conectado a ${info.name}. Tu clave no puede ver la lista de modelos: escribe el nombre del modelo a mano.`)
        setKey('')
        onDone()
        return
      }
      setError(err instanceof AiError ? err.message : 'No se pudo comprobar la clave. Vuelve a intentarlo.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <form className="ai-key-form" onSubmit={submit}>
      <label className="ai-label" htmlFor={inputId}>
        Clave de API de {info.name}
      </label>
      <div className="input-row">
        <input
          id={inputId}
          className="ai-key-input"
          type={visible ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder={`${info.keyPrefix}…`}
          value={key}
          onChange={(e) => {
            setKey(e.target.value)
            setError(null)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        <button
          type="button"
          className="btn btn-icon"
          aria-label={visible ? 'Ocultar la clave' : 'Mostrar la clave'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <a className="text-link ai-key-link" href={info.keyUrl} target="_blank" rel="noopener noreferrer">
        Consigue tu clave en la web de {info.company} <ExternalLink size={13} aria-hidden="true" />
      </a>
      {suspicious && <p className="hint">Esta clave no parece de {info.name} (suelen empezar por «{info.keyPrefix}»).</p>}
      {error && (
        <p className="error-text" id={`${inputId}-error`} role="alert">
          {error}
        </p>
      )}
      <div className="ai-actions">
        <button type="submit" className="btn btn-primary" disabled={!cleaned || checking}>
          {checking ? <LoaderCircle size={16} className="ai-spin" aria-hidden="true" /> : null}
          {checking ? 'Comprobando…' : 'Conectar'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

/**
 * Conexión con la IA: elegir proveedor, pegar la clave, elegir modelo y borrar la clave.
 * Se usa la primera vez y desde el botón de ajustes del asistente.
 */
export function ConnectionPanel({ onConnected }: { onConnected?: () => void }) {
  const { settings, selectProvider, forgetKey } = useAiSettings()
  const toast = useToast()
  const [selected, setSelected] = useState<ProviderId | null>(settings.provider)
  const [changingKey, setChangingKey] = useState(false)
  const savedKey = selected ? settings.keys[selected] : undefined
  const groupName = useId()

  const choose = (provider: ProviderId) => {
    setSelected(provider)
    setChangingKey(false)
    // Si ya tiene clave guardada, se usa directamente.
    if (settings.keys[provider]) selectProvider(provider)
  }

  return (
    <div className="ai-connect">
      <fieldset className="ai-providers">
        <legend className="ai-label">Elige tu IA</legend>
        {PROVIDER_IDS.map((id) => {
          const info = PROVIDERS[id]
          const active = selected === id
          return (
            <label key={id} className={`ai-provider ${active ? 'is-active' : ''}`}>
              <input type="radio" name={groupName} value={id} checked={active} onChange={() => choose(id)} />
              <span className="ai-provider-name">
                {info.name}
                {settings.keys[id] && (
                  <span className="ai-provider-saved" title="Clave guardada">
                    <Check size={14} aria-hidden="true" />
                    <span className="ai-sr">(clave guardada)</span>
                  </span>
                )}
              </span>
              <span className="ai-provider-meta">{info.company}</span>
              <span className={`ai-provider-price ${id === 'gemini' ? 'is-free' : ''}`}>{info.price}</span>
            </label>
          )
        })}
      </fieldset>

      {selected && savedKey && !changingKey && (
        <div className="ai-saved">
          <div className="ai-field">
            <span className="ai-label">Clave de {PROVIDERS[selected].name}</span>
            <div className="ai-saved-row">
              <code className="ai-saved-key">{maskKey(savedKey)}</code>
              <button type="button" className="btn btn-small" onClick={() => setChangingKey(true)}>
                Cambiar
              </button>
              <button
                type="button"
                className="btn btn-small ai-danger"
                onClick={() => {
                  forgetKey(selected)
                  toast(`Clave de ${PROVIDERS[selected].name} borrada de este navegador.`)
                }}
              >
                Borrar clave
              </button>
            </div>
          </div>
          <ModelPicker provider={selected} apiKey={savedKey} />
        </div>
      )}

      {selected && (!savedKey || changingKey) && (
        <KeyForm
          key={selected}
          provider={selected}
          onDone={() => {
            setChangingKey(false)
            onConnected?.()
          }}
          onCancel={changingKey ? () => setChangingKey(false) : undefined}
        />
      )}

      <p className="hint ai-privacy">
        <Lock size={13} aria-hidden="true" />
        <span>
          Tu clave se guarda solo en este navegador y va directa a la IA que elijas: LockIn no tiene servidor y no la ve nadie más. Lo que
          gastes lo cobra (o lo regala) esa IA en tu cuenta.
        </span>
      </p>
    </div>
  )
}
