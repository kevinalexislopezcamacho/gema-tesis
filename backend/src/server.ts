import express, { Express, json } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { prisma } from './lib/prisma'
import authRoutes from './routes/auth'
import studentRoutes from './routes/students'
import topicRoutes from './routes/topics'
import videoRoutes from './routes/videos'
import chatRoutes from './routes/chat'
import questionRoutes from './routes/questions'
import executeRoutes from './routes/execute'
import analyticsRoutes from './routes/analytics'

dotenv.config()

const app: Express = express()

// Middlewares
app.use(json())
// CORS_ORIGIN accepts a comma-separated list — lets both the domain and the
// raw IP:port keep working at once during the transition to the domain,
// instead of one silently breaking the other's API calls.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3002')
  .split(',')
  .map(o => o.trim())
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
)

// Rutas
app.use('/api/auth', authRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/topics', topicRoutes)
app.use('/api/videos', videoRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api', questionRoutes)
app.use('/api', executeRoutes)
app.use('/api/analytics', analyticsRoutes)

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' })
})

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  })
})

// Inicializar servidor
const PORT = process.env.PORT || 8000

const initializeServer = async () => {
  try {
    // Inicializar tópicos si no existen
    const existingTopics = await prisma.topic.count()
    if (existingTopics === 0) {
      await prisma.topic.createMany({
        data: [
          {
            topicId: 'datos',
            name: 'Tipos de Datos',
            icon: '{ }',
            description: 'Variables, constantes y tipos primitivos',
            videos: 3,
            difficulty: 'easy',
            xpReward: 50
          },
          {
            topicId: 'operaciones-logicas',
            name: 'Operaciones Lógicas',
            icon: '&&',
            description: 'AND, OR, NOT y expresiones booleanas',
            videos: 3,
            difficulty: 'easy',
            xpReward: 50
          },
          {
            topicId: 'filtros',
            name: 'Filtros',
            icon: '?:',
            description: 'Filtrado de datos y validaciones',
            videos: 3,
            difficulty: 'easy',
            xpReward: 50
          },
          {
            topicId: 'condicionales',
            name: 'Condicionales',
            icon: 'if',
            description: 'If, else, switch y toma de decisiones',
            videos: 3,
            difficulty: 'medium',
            xpReward: 100
          },
          {
            topicId: 'bucles',
            name: 'Bucles',
            icon: 'for',
            description: 'For, while, do-while e iteraciones',
            videos: 3,
            difficulty: 'medium',
            xpReward: 100
          },
          {
            topicId: 'funciones',
            name: 'Funciones',
            icon: 'fn',
            description: 'Declaración, parámetros y retorno',
            videos: 3,
            difficulty: 'medium',
            xpReward: 100
          },
          {
            topicId: 'arreglos',
            name: 'Arreglos',
            icon: '[ ]',
            description: 'Arrays unidimensionales y métodos',
            videos: 3,
            difficulty: 'advanced',
            xpReward: 200
          },
          {
            topicId: 'matrices',
            name: 'Matrices',
            icon: '[[ ]]',
            description: 'Arrays bidimensionales y operaciones',
            videos: 3,
            difficulty: 'advanced',
            xpReward: 200
          }
        ]
      })

      console.log('✓ Tópicos inicializados correctamente')
    }

    const adminCount = await prisma.user.count({
      where: { role: 'admin' }
    })

    if (adminCount === 0) {
      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.default.hash('admin123', 10)

      await prisma.user.create({
        data: {
          name: 'Dr. Roberto Silva',
          email: 'admin@universidad.edu',
          password: hashedPassword,
          role: 'admin'
        }
      })
      console.log('✓ Admin creado: admin@universidad.edu')
    }

    app.listen(PORT, () => {
      console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`)
      console.log(`📊 Documentación: http://localhost:${PORT}/api/docs`)
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
    })
  } catch (error) {
    console.error('❌ Error al inicializar el servidor:', error)
    process.exit(1)
  }
}

initializeServer()

export default app
