import { Download, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { backupFileName, clearData, createBackup, parseBackup, restoreBackup } from './backup'

/** Pestaña «Datos» de Ajustes: copia para cambiar de ordenador y borrado. */
export function DataSettings() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const download = () => {
    const now = new Date()
    const blob = new Blob([JSON.stringify(createBackup(localStorage, now), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName(now)
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ text: 'Copia descargada. Cárgala en el otro ordenador desde aquí mismo.' })
  }

  const load = async (file: File | undefined) => {
    if (!file) return
    try {
      const backup = parseBackup(await file.text())
      if (!window.confirm('Se sustituirán tus datos de este navegador por los de la copia. ¿Seguimos?')) return
      restoreBackup(localStorage, backup)
      window.location.reload()
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'No se ha podido cargar la copia.', error: true })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="settings-section">
      <p className="hint">
        Tus tareas, notas, tarjetas, historial y ajustes solo están en este navegador. Para usarlos en otro ordenador,
        descarga una copia aquí y cárgala allí.
      </p>
      <div className="account-actions">
        <button type="button" className="btn btn-primary" onClick={download}>
          <Download size={16} /> Descargar copia
        </button>
        <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
          <Upload size={16} /> Cargar copia
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void load(e.target.files?.[0])}
        />
      </div>
      {message && (
        <p className={message.error ? 'error-text' : 'hint'} role="status">
          {message.text}
        </p>
      )}
      <p className="hint">La copia no incluye tus claves de IA: por seguridad, vuelve a pegarlas en el otro ordenador.</p>

      <div className="setting">
        <span className="setting-label">Empezar de cero</span>
        {confirmClear ? (
          <div className="account-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                clearData(localStorage)
                window.location.reload()
              }}
            >
              <Trash2 size={16} /> Sí, borrar todo
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <div>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(true)}>
              <Trash2 size={16} /> Borrar todos mis datos de este navegador
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
