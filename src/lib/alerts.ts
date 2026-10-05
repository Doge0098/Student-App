let audio: AudioContext | null = null

/** Debe llamarse desde un clic: los navegadores solo dejan sonar audio tras una interacción. */
export function primeAudio(): void {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    /* sin audio disponible */
  }
}

export function playChime(): void {
  try {
    audio ??= new AudioContext()
    const ctx = audio
    const start = ctx.currentTime
    ;[660, 880, 1046].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t = start + i * 0.2
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.75)
    })
  } catch {
    /* sin audio disponible */
  }
}

export function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission()
  }
}

export function notify(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body, icon: `${import.meta.env.BASE_URL}favicon.svg`, tag: 'student-app-timer' })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* algunos navegadores móviles no permiten crear notificaciones así */
  }
}
