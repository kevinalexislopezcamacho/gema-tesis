"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-[1600px] mx-auto px-6 h-[68px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-[34px] h-[34px] rounded-[9px] bg-primary/15 flex items-center justify-center">
            <span className="font-mono font-bold text-sm text-primary">{"</>"}</span>
          </div>
          <span className="font-extrabold text-base tracking-tight">GEMA</span>
        </Link>

        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button className="rounded-[10px] shadow-lg shadow-primary/25" asChild>
            <Link href="/register">Registrarse</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
