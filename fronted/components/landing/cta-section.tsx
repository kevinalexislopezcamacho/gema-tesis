"use client"

import Link from "next/link"
import { ArrowRight, Code2, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CTASection() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-primary/10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[200px]" />
      
      <div className="max-w-5xl mx-auto relative">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-6">
            <Code2 className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-balance">
            Transforma tu forma de
            <br />
            <span className="text-primary">aprender a programar</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Únete a la revolución del micro-learning inteligente. 
            Comienza tu viaje hacia el dominio de la programación hoy.
          </p>
        </div>

        {/* Two CTAs */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* For Students */}
          <div className="group relative p-8 rounded-3xl border border-primary/30 bg-card/50 backdrop-blur-sm hover:bg-card hover:border-primary/50 transition-all duration-300">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Soy Estudiante</h3>
              <p className="text-muted-foreground mb-6">
                Accede a videos personalizados, practica con el chatbot 
                y domina los fundamentos de programación.
              </p>
              <Button className="w-full group/btn bg-primary hover:bg-primary/90 text-primary-foreground py-6 rounded-xl font-semibold shadow-lg shadow-primary/25" asChild>
                <Link href="/register">
                  Comenzar a aprender
                  <ArrowRight className="ml-2 w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>
          </div>

          {/* For Teachers */}
          <div className="group relative p-8 rounded-3xl border border-accent/30 bg-card/50 backdrop-blur-sm hover:bg-card hover:border-accent/50 transition-all duration-300">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Soy Docente</h3>
              <p className="text-muted-foreground mb-6">
                Gestiona contenido, monitorea el progreso de tus estudiantes 
                y accede a analíticas detalladas.
              </p>
              <Button variant="outline" className="w-full py-6 rounded-xl font-semibold border-accent/50 hover:bg-accent/10 hover:border-accent text-foreground" asChild>
                <Link href="/login">
                  Acceder al panel
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">Proyecto de tesis para educación superior</p>
          <div className="flex items-center justify-center gap-8 text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm">IA Generativa</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm">Micro-learning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm">Gamificación</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
