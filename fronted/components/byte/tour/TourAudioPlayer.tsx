"use client"

import { useEffect, useRef, useState } from "react"
import { Volume2, Pause } from "lucide-react"

interface Props {
  src: string
  stepId: string
  /**
   * Intenta reproducir automáticamente al montar. Solo debe ser true cuando
   * este paso se alcanzó por un gesto del usuario (clic en "Siguiente") —
   * el primer paso (auto-mostrado sin clic previo) siempre debe ir en false,
   * porque los navegadores pueden bloquear el autoplay sin gesto.
   */
  autoPlay: boolean
}

export function TourAudioPlayer({ src, stepId, autoPlay }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    setPlaying(false)
    audio.pause()
    audio.currentTime = 0
    if (autoPlay) {
      // Si el navegador bloquea el autoplay, cae con gracia al botón manual
      // — nunca se muestra como error.
      audio.play().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId, autoPlay])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.currentTime = playing ? audio.currentTime : (audio.ended ? 0 : audio.currentTime)
      audio.play().catch(() => {})
    }
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
    >
      {playing ? <Pause className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      {playing ? "Pausar" : "Reproducir narración"}
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        preload="auto"
      />
    </button>
  )
}
