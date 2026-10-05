import { Settings2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../../hooks/store'
import { CardsMode } from './CardsMode'
import { ChatMode } from './ChatMode'
import { ConnectionPanel } from './ConnectionPanel'
import { PROVIDERS } from './providers'
import { QuizMode } from './QuizMode'
import { AI_MODES, modeStore } from './session'
import { activeConfig, loadModels, modelListStore, useAiSettings } from './store'
import { SummaryMode } from './SummaryMode'
import './ai.css'

/**
 * Asistente de estudio con IA. Cada estudiante usa su propia clave de la IA que elija
 * (Claude, ChatGPT o Gemini); se guarda solo en su navegador y va directa al proveedor.
 * Ocupa todo el alto que le den y hace scroll por dentro.
 */
export function AiAssistant() {
  const { settings } = useAiSettings()
  const [lists] = useStore(modelListStore)
  const [mode, setMode] = useStore(modeStore)
  const [showSettings, setShowSettings] = useState(false)
  const config = activeConfig(settings, lists)
  const provider = settings.provider
  const apiKey = provider ? settings.keys[provider] : undefined

  // En segundo plano se pide la lista de modelos (sirve para saber qué admite cada uno).
  useEffect(() => {
    if (provider && apiKey) loadModels(provider, apiKey).catch(() => {})
  }, [provider, apiKey])

  if (!config) {
    return (
      <div className="ai-view">
        <div className="ai">
          <header className="ai-intro">
            <h2 className="ai-title">Asistente de IA</h2>
            <p className="hint">
              Resuelve dudas, resume tus apuntes y crea tests y tarjetas. Usa tu propia clave de la IA que prefieras (si no tienes, Gemini
              tiene un plan gratis).
            </p>
          </header>
          <ConnectionPanel />
        </div>
      </div>
    )
  }

  return (
    <div className="ai-view">
      <div className="ai">
        <div className="ai-head">
          <div className="segmented ai-modes" role="group" aria-label="Qué quieres hacer">
            {AI_MODES.map((m) => (
              <button key={m.id} type="button" className={mode === m.id ? 'is-active' : ''} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`btn btn-small ai-settings-btn ${showSettings ? 'is-open' : ''}`}
            aria-expanded={showSettings}
            aria-controls="ai-settings"
            aria-label={`Ajustes de la IA: ${PROVIDERS[config.provider].name}`}
            title={`Ajustes de la IA (${config.modelInfo?.label ?? config.model})`}
            onClick={() => setShowSettings((v) => !v)}
          >
            {showSettings ? <X size={14} aria-hidden="true" /> : <Settings2 size={14} aria-hidden="true" />}
            <span className="ai-settings-name">{PROVIDERS[config.provider].name}</span>
          </button>
        </div>

        {showSettings && (
          <section id="ai-settings" className="ai-settings" aria-label="Ajustes de la IA">
            <ConnectionPanel onConnected={() => setShowSettings(false)} />
            <button type="button" className="btn btn-small ai-settings-done" onClick={() => setShowSettings(false)}>
              Listo
            </button>
          </section>
        )}

        {mode === 'chat' && <ChatMode config={config} />}
        {mode === 'summary' && <SummaryMode config={config} />}
        {mode === 'quiz' && <QuizMode config={config} />}
        {mode === 'cards' && <CardsMode config={config} />}
      </div>
    </div>
  )
}
