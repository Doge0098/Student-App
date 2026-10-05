import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  icon?: ReactNode
  /** Si no se pasa, el modal no se puede cerrar con Escape: hay que elegir una opción. */
  onClose?: () => void
  children: ReactNode
}

export function Modal({ open, title, icon, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose?.()
      }}
    >
      {open && (
        <div className="modal-content">
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
