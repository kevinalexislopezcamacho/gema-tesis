import mongoose, { Schema, Document } from 'mongoose'

export interface IStudentProgress extends Document {
  userId: string
  completedTopics: string[]
  currentTopic: string | null
  totalXP: number
  level: number
  streak: number
  videosWatched: number
  chatbotSessions: number
  learningMode: 'video' | 'chatbot'
  lastActivityAt: Date
  createdAt: Date
  updatedAt: Date
}

const studentProgressSchema = new Schema<IStudentProgress>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      ref: 'User'
    },
    completedTopics: {
      type: [String],
      default: []
    },
    currentTopic: {
      type: String,
      default: null
    },
    totalXP: {
      type: Number,
      default: 0,
      min: 0
    },
    level: {
      type: Number,
      default: 1,
      min: 1
    },
    streak: {
      type: Number,
      default: 0,
      min: 0
    },
    videosWatched: {
      type: Number,
      default: 0,
      min: 0
    },
    chatbotSessions: {
      type: Number,
      default: 0,
      min: 0
    },
    learningMode: {
      type: String,
      enum: ['video', 'chatbot'],
      default: 'video'
    },
    lastActivityAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
)

// Índice para búsquedas rápidas
studentProgressSchema.index({ userId: 1 })

export const StudentProgress = mongoose.model<IStudentProgress>(
  'StudentProgress',
  studentProgressSchema
)
