import { Plus, X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { CourseSelector } from './CourseSelector'
import { addDistraction } from './myDistractions'
import { MODES, MODE_IDS, useProfile } from './profile'
import './study.css'

/** Ajustes › Estudio: curso, modo de estudio y la lista propia de distracciones. */
export function StudySettings() {
  const profile = useProfile()
  const modeName = useId()
  const errorId = useId()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    const result = addDistraction(draft, profile.extraDistractions)
    if (!result.ok) {
      setError(result.error)
      return
    }
    profile.setExtraDistractions(result.list)
    setDraft('')
    setError(null)
  }

  const remove = (domain: string) => profile.setExtraDistractions(profile.extraDistractions.filter((d) => d !== domain))

  return (
    <div className="settings-section">
      <div className="setting">
        <span className="setting-label">Tu curso</span>
        <p className="hint">Adapta las asignaturas y las apps que te recomiendo.</p>
        <CourseSelector value={profile.level} onChange={profile.setLevel} />
      </div>

      <div className="setting">
        <span className="setting-label">Modo de estudio</span>
        <div className="study-choices study-modes" role="radiogroup" aria-label="Modo de estudio">
          {MODE_IDS.map((id) => (
            <label key={id} className={`study-choice ${profile.mode === id ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name={modeName}
                value={id}
                checked={profile.mode === id}
                onChange={() => profile.setMode(id)}
              />
              <span className="study-choice-text">
                <span className="study-choice-label">{MODES[id].label}</span>
                <span className="study-choice-hint">{MODES[id].description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="setting">
        <span className="setting-label">Mis distracciones</span>
        <p className="hint">
          Ya vigilo redes sociales, reels, series y juegos. Añade otras webs que te distraigan: las trato igual, según tu
          modo.
        </p>
        <form className="input-row" onSubmit={add}>
          <input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError(null)
            }}
            placeholder="Por ejemplo, marca.com"
            aria-label="Web que te distrae"
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
          />
          <button type="submit" className="btn" disabled={!draft.trim()}>
            <Plus size={16} aria-hidden="true" /> Añadir
          </button>
        </form>
        {error && (
          <p className="error-text" id={errorId} role="alert">
            {error}
          </p>
        )}
        {profile.extraDistractions.length > 0 && (
          <ul className="study-domains" aria-label="Tus distracciones">
            {profile.extraDistractions.map((domain) => (
              <li key={domain} className="study-domain">
                <span>{domain}</span>
                <button type="button" className="icon-btn" aria-label={`Quitar ${domain}`} title="Quitar" onClick={() => remove(domain)}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
