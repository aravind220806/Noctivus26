import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(sourceDirectory, '../.env'), quiet: true });
dotenv.config({ path: process.env.ATLAS_CREDENTIALS_FILE || path.resolve(sourceDirectory, '../../atlas-credentials.env'), quiet: true });

const port = Number(process.env.PORT || 4000);

if (process.env.MONGODB_URI) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 2),
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 8000),
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    if (process.env.NODE_ENV === 'production') process.exit(1);
  }
}

const server = createApp().listen(port, '0.0.0.0', (error) => {
  if (error) {
    console.error('API failed to start:', error.message);
    process.exitCode = 1;
    return;
  }
  console.log(`Noctivus API listening on http://localhost:${port}`);
});

server.on('error', (error) => {
  console.error('API server error:', error.message);
  process.exitCode = 1;
});
