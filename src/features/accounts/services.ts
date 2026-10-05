export type ServiceId = 'google'

interface ServiceInfo {
  name: string
  /** Qué se desbloquea al iniciar sesión. */
  unlocks: string
  loginUrl: string
  switchUrl?: string
  logoutUrl: string
}

/**
 * El inicio de sesión se hace siempre en la página oficial de cada servicio.
 * LockIn nunca ve ni guarda contraseñas: el navegador recuerda la sesión
 * y los reproductores y documentos incrustados la usan.
 */
export const SERVICES: Record<ServiceId, ServiceInfo> = {
  google: {
    name: 'Google',
    unlocks: 'Editar tus Docs, Hojas y Presentaciones aquí dentro, y usar Drive, Classroom, Gmail, Calendar y YouTube.',
    loginUrl: 'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fwww.google.com%2F',
    switchUrl: 'https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fwww.google.com%2F',
    logoutUrl: 'https://accounts.google.com/Logout',
  },
}
