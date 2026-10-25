import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI, env.MONGODB_DB_NAME ? { dbName: env.MONGODB_DB_NAME } : {});
  console.log('MongoDB connected');
}
