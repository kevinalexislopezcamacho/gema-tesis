"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { 
  Terminal, 
  ArrowLeft,
  Eye,
  EyeOff,
  Rocket,
  CheckCircle2,
  Zap,
  Trophy,
  Bot
} from "lucide-react"

const BENEFITS = [
  { icon: Zap, text: "Videos generados con IA en tiempo real" },
  { icon: Bot, text: "Chatbot personalizado para dudas" },
  { icon: Trophy, text: "Sistema de gamificacion y logros" },
]

export default function RegisterPage() {
  const router = useRouter()
  const { register, isLoading } = useAuth()
  
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState("")

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden")
      return
    }
    
    if (!acceptTerms) {
      setError("Debes aceptar los terminos y condiciones")
      return
    }
    
    const result = await register(name, email, password)
    if (result.success) {
      router.push("/dashboard/student")
    } else {
      setError(result.error || "Error al registrarse")
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-primary/10 text-6xl font-mono animate-float">{"{"}</div>
        <div className="absolute top-40 right-20 text-primary/10 text-4xl font-mono animate-float" style={{ animationDelay: "2s" }}>{"=>"}</div>
        <div className="absolute bottom-40 left-20 text-primary/10 text-5xl font-mono animate-float" style={{ animationDelay: "4s" }}>{"</>"}</div>
        <div className="absolute bottom-20 right-10 text-primary/10 text-6xl font-mono animate-float" style={{ animationDelay: "1s" }}>{"}"}</div>
        
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="p-6">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al inicio</span>
          </Link>
        </header>

        {/* Main content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center">
            {/* Benefits section */}
            <div className="hidden md:block">
              <h1 className="text-3xl font-bold mb-4">
                Comienza tu viaje en{" "}
                <span className="text-primary">programacion</span>
              </h1>
              <p className="text-muted-foreground mb-8">
                Unete a miles de estudiantes que estan aprendiendo Fundamentos de Programacion 
                con nuestra plataforma de micro-learning potenciada por IA.
              </p>
              
              <div className="space-y-4">
                {BENEFITS.map((benefit, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-lg bg-card/50 border border-border/50"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <benefit.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-foreground">{benefit.text}</span>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-8">
                <div className="text-center p-4 rounded-lg bg-card/30">
                  <div className="text-2xl font-bold text-primary">8</div>
                  <div className="text-xs text-muted-foreground">Modulos</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-card/30">
                  <div className="text-2xl font-bold text-accent">24+</div>
                  <div className="text-xs text-muted-foreground">Videos IA</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-card/30">
                  <div className="text-2xl font-bold text-foreground">100%</div>
                  <div className="text-xs text-muted-foreground">Gratuito</div>
                </div>
              </div>
            </div>

            {/* Register form */}
            <div>
              {/* Logo mobile */}
              <div className="text-center mb-6 md:hidden">
                <Link href="/" className="inline-flex items-center gap-3 group">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                      <Terminal className="w-6 h-6 text-primary" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse" />
                  </div>
                  <div className="text-left">
                    <span className="text-xl font-bold text-foreground">CodePath</span>
                    <span className="text-xl font-bold text-primary">AI</span>
                  </div>
                </Link>
              </div>

              <Card className="bg-card/50 backdrop-blur-xl border-border/50">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-2xl flex items-center justify-center gap-2">
                    <Rocket className="w-6 h-6 text-primary" />
                    Crear Cuenta
                  </CardTitle>
                  <CardDescription>
                    Registrate como estudiante para comenzar
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-4">
                    <FieldGroup>
                      <Field>
                        <FieldLabel>Nombre completo</FieldLabel>
                        <Input
                          type="text"
                          placeholder="Juan Perez"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          className="bg-secondary/50 border-border/50"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Correo electronico institucional</FieldLabel>
                        <Input
                          type="email"
                          placeholder="tu@universidad.edu"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="bg-secondary/50 border-border/50"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Contrasena</FieldLabel>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Minimo 6 caracteres"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="bg-secondary/50 border-border/50 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </Field>
                      <Field>
                        <FieldLabel>Confirmar contrasena</FieldLabel>
                        <Input
                          type="password"
                          placeholder="Repite tu contrasena"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="bg-secondary/50 border-border/50"
                        />
                        {confirmPassword && password === confirmPassword && (
                          <div className="flex items-center gap-1 text-primary text-xs mt-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Las contrasenas coinciden
                          </div>
                        )}
                      </Field>
                    </FieldGroup>

                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms"
                        checked={acceptTerms}
                        onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                        className="mt-1"
                      />
                      <label htmlFor="terms" className="text-sm text-muted-foreground">
                        Acepto los{" "}
                        <Link href="#" className="text-primary hover:underline">
                          terminos y condiciones
                        </Link>{" "}
                        y la{" "}
                        <Link href="#" className="text-primary hover:underline">
                          politica de privacidad
                        </Link>
                      </label>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-primary hover:bg-primary/90"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Spinner className="mr-2" />
                          Creando cuenta...
                        </>
                      ) : (
                        <>
                          <Rocket className="w-4 h-4 mr-2" />
                          Crear Cuenta
                        </>
                      )}
                    </Button>

                    <div className="text-center text-sm text-muted-foreground">
                      Ya tienes cuenta?{" "}
                      <Link href="/login" className="text-primary hover:underline">
                        Inicia sesion
                      </Link>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
