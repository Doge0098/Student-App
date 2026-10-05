import { useEffect, useRef } from 'react'
import { useToast } from '../../components/Toast'
import { useStore } from '../../hooks/store'
import { useTimer } from '../timer/TimerContext'
import { useAmbient } from './AmbientContext'
import { holdOnBreak, nextHold, pauseMessage, shouldResume, timerTransition, type Hold, type TimerPoint } from './autoPause'
import { autoPauseStore } from './musicStores'

interface MusicPlayback {
  isPlaying: boolean
  /** Lo que está cargado (enlace). Si cambia, lo pausado por LockIn ya no cuenta. */
  sourceKey: string | null
  pause: () => void
  resume: () => void
}

/**
 * «Pausar en los descansos»: pausa la música y el sonido ambiente al empezar el descanso
 * y reanuda solo eso al empezar el siguiente bloque de concentración. Lo usa MusicProvider.
 */
export function useAutoPause(music: MusicPlayback): void {
  const { phase, status } = useTimer()
  const ambient = useAmbient()
  const toast = useToast()
  const [enabled] = useStore(autoPauseStore)
  const holds = useRef<{ music: Hold; ambient: Hold }>({ music: 'none', ambient: 'none' })
  const lastTimer = useRef<TimerPoint>({ phase, status })
  const lastSource = useRef(music.sourceKey)

  // Lo que hacen el estudiante o el reproductor manda sobre lo que recordaba LockIn.
  useEffect(() => {
    holds.current.music = nextHold(holds.current.music, music.isPlaying)
  }, [music.isPlaying])

  useEffect(() => {
    holds.current.ambient = nextHold(holds.current.ambient, ambient.playing)
  }, [ambient.playing])

  useEffect(() => {
    if (lastSource.current === music.sourceKey) return
    lastSource.current = music.sourceKey
    holds.current.music = 'none'
  }, [music.sourceKey])

  useEffect(() => {
    const transition = timerTransition(lastTimer.current, { phase, status })
    lastTimer.current = { phase, status }

    if (transition === 'break-start' && enabled !== false) {
      const musicPlaying = music.sourceKey !== null && music.isPlaying
      const ambientPlaying = ambient.playing
      holds.current = { music: holdOnBreak(musicPlaying), ambient: holdOnBreak(ambientPlaying) }
      if (musicPlaying) music.pause()
      if (ambientPlaying) ambient.stop({ keepAwake: true })
      const message = pauseMessage(musicPlaying, ambientPlaying)
      if (message) toast(message)
    } else if (transition === 'focus-start') {
      const { music: musicHold, ambient: ambientHold } = holds.current
      holds.current = { music: 'none', ambient: 'none' }
      if (shouldResume(musicHold)) music.resume()
      if (shouldResume(ambientHold)) ambient.play()
    }
  }, [phase, status, enabled, music, ambient, toast])
}
