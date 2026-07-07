"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, Sparkles, GraduationCap, BookOpen } from "lucide-react"

const codeSnippets = [
  { code: "for i in range(10):", lang: "python" },
  { code: "if (condicion) {", lang: "javascript" },
  { code: "array.filter(x => x > 0)", lang: "javascript" },
  { code: "def calcular(n):", lang: "python" },
  { code: "while (true) {", lang: "javascript" },
]

export function HeroSection() {
  const [currentSnippet, setCurrentSnippet] = useState(0)
  const [displayText, setDisplayText] = useState("")
  const [isTyping, setIsTyping] = useState(true)

  useEffect(() => {
    const snippet = codeSnippets[currentSnippet].code
    if (isTyping) {
      if (displayText.length < snippet.length) {
        const timeout = setTimeout(() => {
          setDisplayText(snippet.slice(0, displayText.length + 1))
        }, 80)
        return () => clearTimeout(timeout)
      } else {
        const timeout = setTimeout(() => setIsTyping(false), 2000)
        return () => clearTimeout(timeout)
      }
    } else {
      if (displayText.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1))
        }, 40)
        return () => clearTimeout(timeout)
      } else {
        setCurrentSnippet((prev) => (prev + 1) % codeSnippets.length)
        setIsTyping(true)
      }
    }
  }, [displayText, isTyping, currentSnippet])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,149,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,149,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      {/* Floating code particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute text-primary/20 font-mono text-xs animate-float"
            style={{
              left: `${(i * 37 + 13) % 100}%`,
              top: `${(i * 53 + 7) % 100}%`,
              animationDelay: `${(i * 0.7) % 5}s`,
              animationDuration: `${15 + (i % 10)}s`,
            }}
          >
            {["{ }", "< />", "[ ]", "( )", "=>", "++", "//"][i % 7]}
          </div>
        ))}
      </div>

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-accent/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
          <Sparkles className="w-4 h-4" />
          <span>Impulsado por IA Generativa</span>
        </div>

        {/* Main heading */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6">
          <span className="text-foreground">Aprende a</span>
          <br />
          <span className="bg-gradient-to-r from-primary via-sky-400 to-primary bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
            programar
          </span>
          <br />
          <span className="text-foreground">a tu ritmo</span>
        </h1>

        {/* Terminal */}
        <div className="max-w-md mx-auto mb-8">
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden shadow-2xl shadow-primary/5">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/50">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-2 text-xs text-muted-foreground font-mono">codepath.ai</span>
            </div>
            <div className="p-4 font-mono text-left">
              <span className="text-muted-foreground">{">"}</span>
              <span className="text-primary ml-2">{displayText}</span>
              <span className="animate-blink text-primary">|</span>
            </div>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed text-balance">
          Plataforma inteligente de micro-learning con videos educativos,
          evaluación adaptativa y gamificación para dominar los
          <span className="text-foreground font-medium"> Fundamentos de Programación</span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          <Button
            size="lg"
            className="group bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg rounded-xl shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-105"
            asChild
          >
            <Link href="/register">
              <GraduationCap className="mr-2 w-5 h-5" />
              Soy estudiante
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="group px-8 py-6 text-lg rounded-xl border-border hover:bg-secondary/50 transition-all"
            asChild
          >
            <Link href="/login">
              <BookOpen className="mr-2 w-5 h-5 text-primary" />
              Soy docente
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
          {[
            { value: "8", label: "Módulos" },
            { value: "24+", label: "Videos" },
            { value: "3", label: "Niveles" },
            { value: "100%", label: "Adaptativo" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-primary rounded-full animate-scroll" />
        </div>
      </div>
    </section>
  )
}
