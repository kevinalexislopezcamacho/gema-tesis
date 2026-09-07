import { prisma } from '../lib/prisma'
import { Response } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { AuthRequest } from '../middleware/auth'
import { serializeProgress } from './studentController'

// Mínimo 8 caracteres, al menos una mayúscula y al menos un número — se
// aplica tanto a cuentas nuevas (register) como al cambio de contraseña
// (updateProfile), para que la regla sea consistente en toda la app.
export function passwordEsDebil(password: string): string | null {
  if (password.length < 8) return 'La contraseña debe tener mínimo 8 caracteres'
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos una letra mayúscula'
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos un número'
  return null
}

const generateToken = (userId: string, email: string, role: string): string => {
  return jwt.sign(
    {
      id: userId,
      email: email,
      role: role
    },
    process.env.JWT_SECRET || 'your_secret_key',
    {
      expiresIn: (process.env.JWT_EXPIRATION || '7d') as any
    }
  )
}

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role = 'student' } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Por favor proporciona nombre, email y contraseña'
      })
    }

    const debilidad = passwordEsDebil(password)
    if (debilidad) {
      return res.status(400).json({ success: false, error: debilidad })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'El email ya está registrado'
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role
      }
    })

    if (role === 'student') {
      await prisma.studentProgress.create({
        data: {
          userId: user.id,
          completedTopics: '[]',
          currentTopic: null,
          totalXP: 0,
          level: 1,
          streak: 0,
          videosWatched: 0,
          chatbotSessions: 0,
          learningMode: 'video'
        }
      })
    }

    const token = generateToken(user.id, user.email, user.role)

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    })
  } catch (error) {
    console.error('Error en registro:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor durante el registro'
    })
  }
}

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Por favor proporciona email y contraseña'
      })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      })
    }

    const token = generateToken(user.id, user.email, user.role)

    let progress = null
    if (user.role === 'student') {
      const raw = await prisma.studentProgress.findUnique({
        where: { userId: user.id }
      })
      if (raw) {
        progress = serializeProgress(raw)
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        progress: progress || undefined
      },
      token
    })
  } catch (error) {
    console.error('Error en login:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor durante el login'
    })
  }
}

export const loginAsAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Por favor proporciona email y contraseña'
      })
    }

    const user = await prisma.user.findFirst({
      where: { 
        email: email.toLowerCase(),
        role: 'admin'
      }
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales de admin inválidas'
      })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales de admin inválidas'
      })
    }

    const token = generateToken(user.id, user.email, user.role)

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    })
  } catch (error) {
    console.error('Error en loginAsAdmin:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor durante el login de admin'
    })
  }
}

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'No autorizado' })
    }

    const { name, currentPassword, newPassword, avatar } = req.body

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' })
    }

    const updateData: { name?: string; password?: string; avatar?: string } = {}

    if (name && name.trim()) updateData.name = name.trim()
    if (avatar !== undefined) updateData.avatar = avatar

    if (currentPassword && newPassword) {
      const valid = await bcrypt.compare(currentPassword, user.password)
      if (!valid) {
        return res.status(400).json({ success: false, error: 'La contraseña actual es incorrecta' })
      }
      const debilidad = passwordEsDebil(newPassword)
      if (debilidad) {
        return res.status(400).json({ success: false, error: debilidad })
      }
      updateData.password = await bcrypt.hash(newPassword, 10)
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'No hay datos para actualizar' })
    }

    const updated = await prisma.user.update({ where: { id: req.user.id }, data: updateData })

    let progress = null
    if (updated.role === 'student') {
      const raw = await prisma.studentProgress.findUnique({ where: { userId: updated.id } })
      if (raw) progress = serializeProgress(raw)
    }

    return res.status(200).json({
      success: true,
      data: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, avatar: updated.avatar, progress: progress || undefined }
    })
  } catch (error) {
    console.error('Error al actualizar perfil:', error)
    return res.status(500).json({ success: false, error: 'Error en el servidor' })
  }
}

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado'
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      })
    }

    let progress = null
    if (user.role === 'student') {
      const raw = await prisma.studentProgress.findUnique({
        where: { userId: user.id }
      })
      if (raw) {
        progress = serializeProgress(raw)
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        progress: progress || undefined
      }
    })
  } catch (error) {
    console.error('Error al obtener usuario actual:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}
