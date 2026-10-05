import { Link2, LogOut, Users } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { BREAK_OPTIONS } from '../../lib/time'
import { useTimer } from '../timer/TimerContext'
import { copyRoomLink } from './roomStore'
import './room.css'

const HONEST_NOTE = 'No hay servidor: la sala es solo el enlace. Por eso no se puede ver quién está dentro.'

/** Indicador pequeño encima del reloj mientras estás en una sala. */
export function RoomBadge() {
  const { room } = useTimer()
  const toast = useToast()
  if (!room) return null
  return (
    <div className="room-badge">
      <span className="room-badge-label" title={`Quien tenga el enlace ve este mismo reloj. ${HONEST_NOTE}`}>
        <Users size={14} aria-hidden="true" /> Sala con amigos
      </span>
      <button
        type="button"
        className="room-copy"
        onClick={async () => {
          if (await copyRoomLink(room)) toast('Enlace copiado: pásaselo a quien quieras.')
        }}
      >
        <Link2 size={13} aria-hidden="true" /> Copiar enlace
      </button>
    </div>
  )
}

/** En una sala no hay pausa (el reloj es de todos): solo salir. */
export function RoomLeaveButton() {
  const { stop } = useTimer()
  return (
    <button type="button" className="btn btn-block" onClick={stop}>
      <LogOut size={16} /> Salir de la sala
    </button>
  )
}

/** Opción discreta con el reloj parado: crea una sala, copia el enlace y entra. */
export function RoomStartButton({ focusMinutes }: { focusMinutes: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn btn-link room-start" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Users size={15} aria-hidden="true" /> Estudiar con amigos
      </button>
      <RoomDialog open={open} focusMinutes={focusMinutes} onClose={() => setOpen(false)} />
    </>
  )
}

interface RoomDialogProps {
  open: boolean
  focusMinutes: number
  onClose: () => void
}

function RoomDialog({ open, focusMinutes, onClose }: RoomDialogProps) {
  const timer = useTimer()
  const toast = useToast()
  const [breakMinutes, setBreakMinutes] = useState<number>(timer.settings.breakMinutes)

  const create = async () => {
    // Se crea y se copia en el mismo clic: el navegador solo deja copiar justo después de pulsar.
    const room = timer.createRoom(focusMinutes, breakMinutes)
    onClose()
    if (!room) return
    const copied = await copyRoomLink(room)
    toast(copied ? 'Sala creada y enlace copiado: pásaselo a tus amigos.' : 'Sala creada.')
  }

  return (
    <Modal open={open} title="Estudiar con amigos" icon={<Users size={28} />} onClose={onClose}>
      <p className="modal-text">
        Crea una sala y comparte el enlace. Todos veréis el mismo reloj: estudiáis y descansáis a la vez.
      </p>
      <p className="room-plan">
        <strong>{focusMinutes} min</strong> de estudio y descanso de:
      </p>
      <div className="chip-row chip-row-center" role="group" aria-label="Duración del descanso">
        {BREAK_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            className={`chip ${breakMinutes === m ? 'is-active' : ''}`}
            aria-pressed={breakMinutes === m}
            onClick={() => setBreakMinutes(m)}
          >
            {m} min
          </button>
        ))}
      </div>
      <p className="hint">{HONEST_NOTE}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-primary" data-autofocus onClick={() => void create()}>
          <Link2 size={18} /> Crear sala y copiar enlace
        </button>
      </div>
    </Modal>
  )
}
