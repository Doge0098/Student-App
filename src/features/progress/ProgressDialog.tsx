import type { CSSProperties } from 'react'
import { Modal } from '../../components/Modal'
import { SUBJECTS } from '../../lib/subjects'
import { todayKey } from '../../lib/time'
import { accentStyle } from '../settings/appearance'
import { useAppearance } from '../settings/AppearanceContext'
import { currentStreak, formatMinutes, lastDays, subjectTotals } from './progress'
import { useProgress } from './store'
import './progress.css'

interface ProgressDialogProps {
  open: boolean
  onClose: () => void
}

/** «Tu progreso»: últimos 7 días, racha y minutos por asignatura. */
export function ProgressDialog({ open, onClose }: ProgressDialogProps) {
  return (
    <Modal open={open} title="Tu progreso" onClose={onClose}>
      {open && <ProgressSummary />}
    </Modal>
  )
}

function ProgressSummary() {
  const progress = useProgress()
  const { panelColor } = useAppearance()
  const color = panelColor('timer')
  const today = todayKey()
  const days = lastDays(progress, today, 7)
  const streak = currentStreak(progress, today)
  const subjects = subjectTotals(progress, today, 7)
  const weekTotal = days.reduce((sum, d) => sum + d.minutes, 0)
  const maxDay = Math.max(1, ...days.map((d) => d.minutes))
  const maxSubject = Math.max(1, ...subjects.map((s) => s.minutes))

  return (
    <div className="study-progress" data-accent={color} style={accentStyle(color)}>
      <dl className="study-stats">
        <div className="study-stat">
          <dt>Racha</dt>
          <dd>
            {streak} {streak === 1 ? 'día' : 'días'}
          </dd>
        </div>
        <div className="study-stat">
          <dt>Últimos 7 días</dt>
          <dd>{formatMinutes(weekTotal)}</dd>
        </div>
      </dl>
      <p className="study-note">La racha cuenta los días seguidos con al menos un bloque completado.</p>

      {weekTotal === 0 ? (
        <p className="study-empty">Esta semana aún no hay minutos. Empieza un bloque y aquí verás tus días.</p>
      ) : (
        <>
          <section className="study-section" aria-labelledby="progress-days">
            <h3 id="progress-days" className="study-heading">
              Minutos por día
            </h3>
            <ol className="study-bars">
              {days.map((d) => (
                <li
                  key={d.date}
                  className={`study-day ${d.isToday ? 'is-today' : ''}`}
                  title={`${d.long}: ${formatMinutes(d.minutes)}`}
                  style={{ '--ratio': d.minutes / maxDay } as CSSProperties}
                >
                  <span className="study-plot" aria-hidden="true">
                    {d.minutes > 0 && <span className="study-value">{d.minutes}</span>}
                    <span className="study-fill" />
                  </span>
                  <span className="study-label" aria-hidden="true">
                    {d.isToday ? 'Hoy' : d.short}
                  </span>
                  <span className="study-sr">
                    {d.isToday ? 'Hoy' : d.long}: {formatMinutes(d.minutes)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="study-section" aria-labelledby="study-subjects">
            <h3 id="study-subjects" className="study-heading">
              Por asignatura
            </h3>
            <ul className="study-subjects">
              {subjects.map(({ subject, minutes }) => {
                const info = SUBJECTS[subject] ?? SUBJECTS.general
                return (
                  <li
                    key={subject}
                    className="study-subject"
                    style={{ '--subject': info.color, '--ratio': minutes / maxSubject } as CSSProperties}
                  >
                    <span className="study-subject-name">
                      <span className="subject-dot" aria-hidden="true" />
                      {info.label}
                    </span>
                    <span className="study-subject-value">{formatMinutes(minutes)}</span>
                    <span className="study-subject-track" aria-hidden="true">
                      <span className="study-subject-fill" />
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
