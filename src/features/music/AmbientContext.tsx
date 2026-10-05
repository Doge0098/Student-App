import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToast } from '../../components/Toast'
import { useStore } from '../../hooks/store'
import { createAmbientEngine, type AmbientEngine } from './ambientEngine'
import { clampVolume, sanitizeAmbient, type AmbientId } from './ambientSounds'
import { ambientStore } from './musicStores'

export interface AmbientContextValue {
  sound: AmbientId
  /** 0 a 100. */
  volume: number
  playing: boolean
  /** Elige el sonido; si ya suena, cambia con un fundido. */
  setSound: (sound: AmbientId) => void
  setVolume: (volume: number) => void
  /** Empieza a sonar. La primera vez debe venir de un clic (lo exige el navegador). */
  play: () => void
  /** Para con un fundido. keepAwake: deja el audio listo para volver sin clic (lo usa la pausa de los descansos). */
  stop: (options?: { keepAwake?: boolean }) => void
  toggle: () => void
}

const AmbientContext = createContext<AmbientContextValue | null>(null)

export function AmbientProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [stored, setStored] = useStore(ambientStore)
  const settings = useMemo(() => sanitizeAmbient(stored), [stored])
  const [playing, setPlaying] = useState(false)
  const engineRef = useRef<AmbientEngine | null>(null)
  const settingsRef = useRef(settings)
  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  const engine = useCallback(() => {
    engineRef.current ??= createAmbientEngine({
      onError: () => {
        setPlaying(false)
        toast('No se pudo preparar el sonido ambiente.')
      },
    })
    return engineRef.current
  }, [toast])

  // Al cerrar (o desmontar) se apaga todo y se libera el audio.
  useEffect(
    () => () => {
      engineRef.current?.dispose()
      engineRef.current = null
    },
    [],
  )

  const play = useCallback(() => {
    const { sound, volume } = settingsRef.current
    if (engine().play(sound, volume)) setPlaying(true)
    else toast('Este navegador no puede reproducir sonidos ambiente.')
  }, [engine, toast])

  const stop = useCallback((options?: { keepAwake?: boolean }) => {
    engineRef.current?.stop(options)
    setPlaying(false)
  }, [])

  const toggle = useCallback(() => {
    if (engineRef.current?.current) stop()
    else play()
  }, [play, stop])

  const setSound = useCallback(
    (sound: AmbientId) => {
      setStored((prev) => ({ ...sanitizeAmbient(prev), sound }))
      settingsRef.current = { ...settingsRef.current, sound }
      const current = engineRef.current
      if (current?.current) current.play(sound, settingsRef.current.volume)
    },
    [setStored],
  )

  const setVolume = useCallback(
    (volume: number) => setStored((prev) => ({ ...sanitizeAmbient(prev), volume: clampVolume(volume) })),
    [setStored],
  )

  // El volumen (también si se cambia en otra pestaña) se aplica con suavidad.
  useEffect(() => {
    engineRef.current?.setVolume(settings.volume)
  }, [settings.volume])

  // Si se elige otro sonido en otra pestaña mientras suena aquí, se cambia también.
  useEffect(() => {
    const current = engineRef.current
    if (playing && current?.current && current.current !== settings.sound) current.play(settings.sound, settings.volume)
  }, [playing, settings.sound, settings.volume])

  const value = useMemo<AmbientContextValue>(
    () => ({ ...settings, playing, setSound, setVolume, play, stop, toggle }),
    [settings, playing, setSound, setVolume, play, stop, toggle],
  )

  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAmbient(): AmbientContextValue {
  const ctx = useContext(AmbientContext)
  if (!ctx) throw new Error('useAmbient debe usarse dentro de <MusicProvider>')
  return ctx
}
