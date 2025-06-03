/**
 * Diabot Backend Server
 * 
 * Main Express server that initializes and coordinates all backend services:
 * - Database connection and initialization
 * - RAG system and ChromaDB integration
 * - API routes for authentication, chat, models, topics, and knowledge management
 * - CORS configuration and middleware setup
 * - Static file serving and error handling
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { initializeServices } from './init.js';

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize database
await initDb();

// Initialize services (RAG, etc.)
await initializeServices();

// Import routes after initialization
const authRoutes = (await import('./routes/auth.js')).default;
const chatRoutes = (await import('./routes/chat.js')).default;
const modelRoutes = (await import('./routes/models.js')).default;
const topicRoutes = (await import('./routes/topics.js')).default;
const ragRoutes = (await import('./routes/rag.js')).default;
const settingsRoutes = (await import('./routes/settings.js')).default;

const app = express();
const PORT = process.env.PORT || 8090;

// Configure CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable preflight for all routes
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/settings', settingsRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Diabot API' });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
});
