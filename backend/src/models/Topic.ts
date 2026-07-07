import mongoose, { Schema, Document } from 'mongoose'

export interface ITopic extends Document {
  id: string
  name: string
  icon: string
  description: string
  videos: number
  difficulty: 'easy' | 'medium' | 'advanced'
  xpReward: number
  createdAt: Date
  updatedAt: Date
}

const topicSchema = new Schema<ITopic>(
  {
    id: {
      type: String,
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true
    },
    icon: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    videos: {
      type: Number,
      default: 3,
      min: 1
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'advanced'],
      default: 'easy'
    },
    xpReward: {
      type: Number,
      default: 100,
      min: 0
    }
  },
  {
    timestamps: true
  }
)

export const Topic = mongoose.model<ITopic>('Topic', topicSchema)
