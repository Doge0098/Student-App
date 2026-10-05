import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToast } from '../../components/Toast'
import { SERVICES, type ServiceId } from './services'

type Versions = Record<ServiceId, number>

interface AccountsValue {
  /** Sube cada vez que el estudiante vuelve de iniciar o cerrar sesión: lo que usa la cuenta se recarga. */
  versions: Versions
  login: (service: ServiceId) => void
  switchAccount: (service: ServiceId) => void
  logout: (service: ServiceId) => void
}

const AccountsContext = createContext<AccountsValue | null>(null)

function openPopup(url: string, name: string) {
  const width = 480
  const height = 680
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2)
  const popup = window.open(url, name, `popup=yes,width=${width},height=${height},left=${left},top=${top}`)
  // Si el navegador bloquea la ventana emergente, se abre en una pestaña normal.
  if (!popup) window.open(url, '_blank')
}

export function AccountsProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [versions, setVersions] = useState<Versions>({ google: 0 })
  const pending = useRef<{ service: ServiceId; at: number; action: 'login' | 'logout' } | null>(null)

  // Al volver a la app después de la ventana de la cuenta, se recargan los reproductores y documentos.
  useEffect(() => {
    const onReturn = () => {
      const p = pending.current
      if (!p || document.visibilityState === 'hidden' || Date.now() - p.at < 1500) return
      pending.current = null
      setVersions((v) => ({ ...v, [p.service]: v[p.service] + 1 }))
      const name = SERVICES[p.service].name
      toast(p.action === 'login' ? `¿Ya has entrado en ${name}? Lo he recargado todo para que use tu cuenta.` : `Recargado sin tu cuenta de ${name}.`)
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onReturn)
    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onReturn)
    }
  }, [toast])

  const start = useCallback((service: ServiceId, url: string, action: 'login' | 'logout') => {
    pending.current = { service, at: Date.now(), action }
    openPopup(url, `lockin-${service}`)
  }, [])

  const value = useMemo<AccountsValue>(
    () => ({
      versions,
      login: (service) => start(service, SERVICES[service].loginUrl, 'login'),
      switchAccount: (service) => start(service, SERVICES[service].switchUrl ?? SERVICES[service].loginUrl, 'login'),
      logout: (service) => start(service, SERVICES[service].logoutUrl, 'logout'),
    }),
    [versions, start],
  )

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAccounts(): AccountsValue {
  const ctx = useContext(AccountsContext)
  if (!ctx) throw new Error('useAccounts debe usarse dentro de <AccountsProvider>')
  return ctx
}
