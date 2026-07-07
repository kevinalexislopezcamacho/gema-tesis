"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type UserRole = "student" | "admin"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  progress?: StudentProgress
}

export interface StudentProgress {
  _id?: string
  userId?: string
  completedTopics: string[]
  currentTopic: string | null
  totalXP: number
  level: number
  streak: number
  videosWatched: number
  chatbotSessions: number
  learningMode: "video" | "chatbot"
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  token: string | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginAsAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateProgress: (topicId: string, difficulty?: string) => Promise<void>
  recordVideoWatch: (topicId: string, difficulty: string, videoId: string, watchedRatio: number) => Promise<{ xp: number; isFirstWatch: boolean; topicCompleted: boolean; watchedLevels: string[] } | null>
  setLearningMode: (mode: "video" | "chatbot") => void
  refreshProgress: () => Promise<void>
  checkDailyLogin: () => Promise<{ changed: boolean; streak: number; previousStreak: number; wasReset: boolean; daysDiff: number } | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"

function buildUser(data: any): User {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    progress: data.progress
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem("codepath-user")
    const savedToken = localStorage.getItem("codepath-token")
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser))
      setToken(savedToken)
      // Refresh progress from API so we never show stale localStorage data
      fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data) {
            const fresh = buildUser(data.data)
            setUser(fresh)
            localStorage.setItem("codepath-user", JSON.stringify(fresh))
          }
        })
        .catch(() => {})
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      })
      const data = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        return { success: false, error: data.error || "Error al iniciar sesión" }
      }
      const userData = buildUser(data.data)
      setUser(userData)
      setToken(data.token)
      localStorage.setItem("codepath-user", JSON.stringify(userData))
      localStorage.setItem("codepath-token", data.token)
      setIsLoading(false)
      return { success: true }
    } catch {
      setIsLoading(false)
      return { success: false, error: "Error de conexión con el servidor" }
    }
  }

  const register = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: "student" })
      })
      const data = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        return { success: false, error: data.error || "Error al registrarse" }
      }
      const userData: User = {
        id: data.data.id,
        name: data.data.name,
        email: data.data.email,
        role: data.data.role,
        progress: {
          completedTopics: [],
          currentTopic: null,
          totalXP: 0,
          level: 1,
          streak: 0,
          videosWatched: 0,
          chatbotSessions: 0,
          learningMode: "video"
        }
      }
      setUser(userData)
      setToken(data.token)
      localStorage.setItem("codepath-user", JSON.stringify(userData))
      localStorage.setItem("codepath-token", data.token)
      setIsLoading(false)
      return { success: true }
    } catch {
      setIsLoading(false)
      return { success: false, error: "Error de conexión con el servidor" }
    }
  }

  const loginAsAdmin = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/auth/login/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      })
      const data = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        return { success: false, error: data.error || "Error al iniciar sesión como admin" }
      }
      const userData = buildUser(data.data)
      setUser(userData)
      setToken(data.token)
      localStorage.setItem("codepath-user", JSON.stringify(userData))
      localStorage.setItem("codepath-token", data.token)
      setIsLoading(false)
      return { success: true }
    } catch {
      setIsLoading(false)
      return { success: false, error: "Error de conexión con el servidor" }
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem("codepath-user")
    localStorage.removeItem("codepath-token")
  }

  const refreshProgress = async () => {
    if (!token) return
    try {
      const r = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await r.json()
      if (data.success && data.data) {
        const fresh = buildUser(data.data)
        setUser(fresh)
        localStorage.setItem("codepath-user", JSON.stringify(fresh))
      }
    } catch {}
  }

  const updateProgress = async (topicId: string, difficulty = "medio") => {
    if (!user || user.role !== "student" || !token) return
    try {
      const r = await fetch(`${API_URL}/students/${user.id}/topics/${topicId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ difficulty })
      })
      if (r.ok) {
        const data = await r.json()
        const updatedUser = { ...user, progress: data.data.progress }
        setUser(updatedUser)
        localStorage.setItem("codepath-user", JSON.stringify(updatedUser))
      }
    } catch {}
  }

  // Called when student finishes watching a video — validates ratio + awards XP with diminishing returns
  const recordVideoWatch = async (
    topicId: string,
    difficulty: string,
    videoId: string,
    watchedRatio: number
  ): Promise<{ xp: number; isFirstWatch: boolean; topicCompleted: boolean; watchedLevels: string[] } | null> => {
    if (!user || user.role !== "student" || !token) return null
    try {
      const r = await fetch(`${API_URL}/students/${user.id}/videos/${videoId}/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ watchedRatio, difficulty, topicId }),
      })
      const data = await r.json()
      if (data.success) {
        const updatedUser = { ...user, progress: data.data.progress }
        setUser(updatedUser)
        localStorage.setItem("codepath-user", JSON.stringify(updatedUser))
        return {
          xp:             data.data.xpGained,
          isFirstWatch:   data.data.isFirstWatch,
          topicCompleted: data.data.topicCompleted ?? false,
          watchedLevels:  data.data.watchedLevels  ?? [],
        }
      }
      return null
    } catch {
      return null
    }
  }

  const setLearningMode = (mode: "video" | "chatbot") => {
    if (!user || user.role !== "student" || !user.progress) return
    const updatedProgress: StudentProgress = { ...user.progress, learningMode: mode }
    const updatedUser = { ...user, progress: updatedProgress }
    setUser(updatedUser)
    localStorage.setItem("codepath-user", JSON.stringify(updatedUser))
    // Persist to backend
    if (token) {
      fetch(`${API_URL}/students/${user.id}/progress`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ learningMode: mode })
      }).catch(() => {})
    }
  }

  const checkDailyLogin = async () => {
    if (!user || user.role !== "student" || !token) return null
    try {
      const r = await fetch(`${API_URL}/students/${user.id}/daily-login`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      if (data.success && data.data.changed && data.data.progress) {
        const updatedUser = { ...user, progress: data.data.progress }
        setUser(updatedUser)
        localStorage.setItem("codepath-user", JSON.stringify(updatedUser))
      }
      return data.success ? data.data : null
    } catch {
      return null
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      token,
      login,
      register,
      loginAsAdmin,
      logout,
      updateProgress,
      recordVideoWatch,
      setLearningMode,
      refreshProgress,
      checkDailyLogin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
