import { prisma } from '../lib/prisma'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'

export const getAllTopics = async (req: AuthRequest, res: Response) => {
  try {
    const topics = await prisma.topic.findMany({
      orderBy: { createdAt: 'asc' }
    })

    return res.status(200).json({
      success: true,
      data: topics.map(topic => ({
        id: topic.id,
        topicId: topic.topicId,
        name: topic.name,
        icon: topic.icon,
        description: topic.description,
        videos: topic.videos,
        difficulty: topic.difficulty,
        xpReward: topic.xpReward
      }))
    })
  } catch (error) {
    console.error('Error al obtener tópicos:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}

export const getTopicById = async (req: AuthRequest, res: Response) => {
  try {
    const { topicId } = req.params

    const topic = await prisma.topic.findUnique({
      where: { topicId }
    })

    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Tópico no encontrado'
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        id: topic.id,
        topicId: topic.topicId,
        name: topic.name,
        icon: topic.icon,
        description: topic.description,
        videos: topic.videos,
        difficulty: topic.difficulty,
        xpReward: topic.xpReward
      }
    })
  } catch (error) {
    console.error('Error al obtener tópico:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}

export const createTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado - Se requieren permisos de administrador'
      })
    }

    const { id, name, icon, description, videos, difficulty, xpReward } = req.body

    if (!id || !name || !icon || !description) {
      return res.status(400).json({
        success: false,
        error: 'Por favor proporciona todos los campos requeridos'
      })
    }

    const existingTopic = await prisma.topic.findUnique({
      where: { topicId: id }
    })

    if (existingTopic) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un tópico con este ID'
      })
    }

    const topic = await prisma.topic.create({
      data: {
        topicId: id,
        name,
        icon,
        description,
        videos: videos || 3,
        difficulty: difficulty || 'easy',
        xpReward: xpReward || 100
      }
    })

    return res.status(201).json({
      success: true,
      data: {
        id: topic.id,
        topicId: topic.topicId,
        name: topic.name,
        icon: topic.icon,
        description: topic.description,
        videos: topic.videos,
        difficulty: topic.difficulty,
        xpReward: topic.xpReward
      }
    })
  } catch (error) {
    console.error('Error al crear tópico:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}

export const updateTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado - Se requieren permisos de administrador'
      })
    }

    const { topicId } = req.params
    const updateData = req.body

    const topic = await prisma.topic.update({
      where: { topicId },
      data: updateData
    })

    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Tópico no encontrado'
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        id: topic.id,
        topicId: topic.topicId,
        name: topic.name,
        icon: topic.icon,
        description: topic.description,
        videos: topic.videos,
        difficulty: topic.difficulty,
        xpReward: topic.xpReward
      }
    })
  } catch (error) {
    console.error('Error al actualizar tópico:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}

export const deleteTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado - Se requieren permisos de administrador'
      })
    }

    const { topicId } = req.params

    const topic = await prisma.topic.delete({
      where: { topicId }
    })

    if (!topic) {
      return res.status(404).json({
        success: false,
        error: 'Tópico no encontrado'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Tópico eliminado exitosamente'
    })
  } catch (error) {
    console.error('Error al eliminar tópico:', error)
    return res.status(500).json({
      success: false,
      error: 'Error en el servidor'
    })
  }
}
