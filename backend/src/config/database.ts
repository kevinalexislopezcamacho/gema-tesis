import mongoose from 'mongoose'

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/codepath'
    const connection = await mongoose.connect(mongoUri)
    console.log(`MongoDB conectado: ${connection.connection.host}`)
    return connection
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error)
    process.exit(1)
  }
}
