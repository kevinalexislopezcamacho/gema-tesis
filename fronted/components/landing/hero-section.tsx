"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const CODE_SNIPPETS = [
  "for i in range(10):",
  "if (condicion) {",
  "array.filter(x => x > 0)",
  "def calcular(n):",
  "while (true) {",
]

const STATS = [
  { value: "8", label: "Módulos" },
  { value: "24+", label: "Videos" },
  { value: "3", label: "Niveles" },
  { value: "100%", label: "Adaptativo" },
]

export function HeroSection() {
  const [snippetIndex, setSnippetIndex] = useState(0)
  const [displayText, setDisplayText] = useState("")
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    const snippet = CODE_SNIPPETS[snippetIndex]
    if (isTyping) {
      if (displayText.length < snippet.length) {
        const t = setTimeout(() => setDisplayText(snippet.slice(0, displayText.length + 1)), 80)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setIsTyping(false), 1500)
      return () => clearTimeout(t)
    }
    if (displayText.length > 0) {
      const t = setTimeout(() => setDisplayText(displayText.slice(0, -1)), 40)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setSnippetIndex((i) => (i + 1) % CODE_SNIPPETS.length)
      setIsTyping(true)
    }, 300)
    return () => clearTimeout(t)
  }, [displayText, isTyping, snippetIndex])

  return (
    <section className="relative overflow-hidden pt-[90px] pb-[70px] px-6">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_72%)]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          opacity: 0.5,
        }}
      />
      <div className="absolute -top-20 left-[8%] w-[360px] h-[360px] rounded-full bg-primary/10 blur-[90px] animate-pulse" />
      <div
        className="absolute -bottom-24 right-[6%] w-80 h-80 rounded-full bg-accent/10 blur-[90px] animate-pulse"
        style={{ animationDelay: "1.2s" }}
      />

      <div className="relative max-w-[1600px] mx-auto grid md:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
        <div>
          <h1 className="text-[40px] sm:text-[52px] leading-[1.06] font-extrabold tracking-tight mb-[22px]">
            Aprende a programar
            <br />a{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              tu propio ritmo
            </span>
          </h1>
          <p className="text-[17px] leading-relaxed text-muted-foreground max-w-[480px] mb-8">
            Micro-learning con videos generados por IA, evaluación adaptativa y gamificación para dominar los
            fundamentos de programación, sin quedarte atrás ni aburrirte.
          </p>
          <div className="flex gap-3.5 flex-wrap">
            <Button size="lg" className="rounded-xl px-[26px] py-[15px] h-auto text-[15px] font-bold shadow-lg shadow-primary/30" asChild>
              <Link href="/register">Soy estudiante</Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-xl px-[26px] py-[15px] h-auto text-[15px] font-bold" asChild>
              <Link href="/login">Soy docente</Link>
            </Button>
          </div>
        </div>

        {/* Code terminal */}
        <div>
          <div className="rounded-[20px] shadow-2xl shadow-black/25 overflow-hidden border border-white/10 bg-[oklch(0.22_0.02_265)]">
            <div className="flex items-center gap-2 px-[18px] py-3.5 bg-[oklch(0.18_0.02_265)] border-b border-white/10">
              <span className="w-[11px] h-[11px] rounded-full bg-[#ff5f57]" />
              <span className="w-[11px] h-[11px] rounded-full bg-[#febc2e]" />
              <span className="w-[11px] h-[11px] rounded-full bg-[#28c840]" />
              <span className="ml-2 text-xs font-mono text-white/50">gema.ai</span>
            </div>
            <div className="px-7 py-9 min-h-[180px]">
              <p className="font-mono text-xs text-white/40 mb-1.5">// aprende programando de verdad</p>
              <p className="font-mono text-[19px] leading-relaxed">
                <span className="text-white/50">{">"}</span>
                <span className="text-primary ml-2.5">{displayText}</span>
                <span className="text-primary animate-blink">|</span>
              </p>
            </div>
            <div className="flex gap-2 px-7 py-4 border-t border-white/10">
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-[11px] font-mono text-white/70">Python</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 text-[11px] font-mono text-white/70">JavaScript</span>
            </div>
          </div>

          <div className="flex gap-9 flex-wrap justify-center mt-7">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-[22px] font-extrabold font-mono m-0">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
