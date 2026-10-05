import { LogIn } from 'lucide-react'
import { useAccounts } from './AccountsContext'
import { SERVICES, type ServiceId } from './services'

/** Botón pequeño para iniciar sesión justo donde hace falta. */
export function LoginButton({ service }: { service: ServiceId }) {
  const { login } = useAccounts()
  return (
    <button type="button" className="btn btn-small" onClick={() => login(service)}>
      <LogIn size={14} /> Iniciar sesión en {SERVICES[service].name}
    </button>
  )
}
