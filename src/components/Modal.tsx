import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  icon?: ReactNode
  /** Si no se pasa, el modal no se puede cerrar con Escape: hay que elegir una opción. */
  onClose?: () => void
  /** Ventana más ancha y alineada a la izquierda, para ajustes. */
  wide?: boolean
  children: ReactNode
}

export function Modal({ open, title, icon, onClose, wide = false, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // El botón principal (marcado con data-autofocus) recibe el foco, no la X de cerrar.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose?.()
      }}
      onClose={() => {
        // Chrome cierra el diálogo aunque se cancele Escape si se pulsa varias veces seguidas.
        // Los avisos obligatorios (sin onClose) se vuelven a abrir: hay que elegir una opción.
        const dialog = ref.current
        if (dialog && openRef.current && !onClose && !dialog.open) dialog.showModal()
      }}
    >
      {open && (
        <div className="modal-content">
          {onClose && (
            <button type="button" className="icon-btn modal-close" aria-label="Cerrar" onClick={onClose}>
              <X size={18} />
            </button>
          )}
          {icon && (
            <div className="modal-icon" aria-hidden="true">
              {icon}
            </div>
          )}
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  )
}
