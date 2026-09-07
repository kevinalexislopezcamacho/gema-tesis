"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { 
  GraduationCap,
  Shield,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { login, loginAsAdmin, isLoading } = useAuth()
  
  const [studentEmail, setStudentEmail] = useState("")
  const [studentPassword, setStudentPassword] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [showStudentPassword, setShowStudentPassword] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("student")

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    const result = await login(studentEmail, studentPassword)
    if (result.success) {
      router.push("/dashboard/student")
    } else {
      setError(result.error || "Error al iniciar sesion")
    }
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    const result = await loginAsAdmin(adminEmail, adminPassword)
    if (result.success) {
      router.push("/dashboard/admin")
    } else {
      setError(result.error || "Error al iniciar sesion")
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
          <div className="w-full max-w-md">
            {/* Logo */}
            <div className="text-center mb-8">
              <Link href="/" className="inline-flex items-center gap-3 group">
                <img src="/logo-icon.png" alt="GEMA" className="w-12 h-12 object-contain" />
                <div className="text-left">
                  <span className="text-xl font-bold text-foreground">GEMA</span>
                  <p className="text-xs text-muted-foreground">Micro-Learning Inteligente</p>
                </div>
              </Link>
            </div>

            <Card className="bg-card/50 backdrop-blur-xl border-border/50">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">Iniciar Sesion</CardTitle>
                <CardDescription>
                  Accede a tu plataforma de aprendizaje
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50">
                    <TabsTrigger 
                      value="student" 
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
                    >
                      <GraduationCap className="w-4 h-4" />
                      Estudiante
                    </TabsTrigger>
                    <TabsTrigger 
                      value="admin"
                      className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      Administrador
                    </TabsTrigger>
                  </TabsList>

                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                      {error}
                    </div>
                  )}

                  <TabsContent value="student">
                    <form onSubmit={handleStudentLogin} className="space-y-4">
                      <FieldGroup>
                        <Field>
                          <FieldLabel>Correo electronico</FieldLabel>
                          <Input
                            type="email"
                            placeholder="tu@universidad.edu"
                            value={studentEmail}
                            onChange={(e) => setStudentEmail(e.target.value)}
                            required
                            className="bg-secondary/50 border-border/50"
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Contraseña</FieldLabel>
                          <div className="relative">
                            <Input
                              type={showStudentPassword ? "text" : "password"}
                              placeholder="Tu contraseña"
                              value={studentPassword}
                              onChange={(e) => setStudentPassword(e.target.value)}
                              required
                              className="bg-secondary/50 border-border/50 pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowStudentPassword(!showStudentPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </Field>
                      </FieldGroup>

                      <Button 
                        type="submit" 
                        className="w-full bg-primary hover:bg-primary/90"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Spinner className="mr-2" />
                            Iniciando sesion...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Iniciar Sesion
                          </>
                        )}
                      </Button>

                      <div className="text-center text-sm text-muted-foreground">
                        No tienes cuenta?{" "}
                        <Link href="/register" className="text-primary hover:underline">
                          Registrate aqui
                        </Link>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="admin">
                    <form onSubmit={handleAdminLogin} className="space-y-4">
                      <FieldGroup>
                        <Field>
                          <FieldLabel>Correo electronico</FieldLabel>
                          <Input
                            type="email"
                            placeholder="admin@universidad.edu"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            required
                            className="bg-secondary/50 border-border/50"
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Contraseña</FieldLabel>
                          <div className="relative">
                            <Input
                              type={showAdminPassword ? "text" : "password"}
                              placeholder="Contraseña de administrador"
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              required
                              className="bg-secondary/50 border-border/50 pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(!showAdminPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </Field>
                      </FieldGroup>

                      <Button 
                        type="submit" 
                        className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Spinner className="mr-2" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 mr-2" />
                            Acceder como Admin
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
