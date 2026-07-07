"use client"

import { Code2 } from "lucide-react"

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="font-bold text-lg">CodePath</span>
              <span className="text-primary font-bold text-lg">AI</span>
            </div>
          </div>

          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Inicio</a>
            <a href="#features" className="hover:text-foreground transition-colors">Características</a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">¿Cómo funciona?</a>
            <a href="#modules" className="hover:text-foreground transition-colors">Módulos</a>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>Trabajo de grado · 2026</p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-xs text-muted-foreground">
          <p>
            Plataforma inteligente de micro-learning basada en IA generativa para Fundamentos de Programación ·
            Universidad de San Buenaventura Cali
          </p>
        </div>
      </div>
    </footer>
  )
}
