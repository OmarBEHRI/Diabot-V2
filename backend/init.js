/**
 * Services Initialization Module
 * 
 * Handles the initialization of all backend services on application startup:
 * - Creates necessary data directories for uploads and summaries
 * - Initializes the RAG system with ChromaDB integration
 * - Provides graceful error handling for service initialization failures
 * - Ensures the application can start even if some services fail to initialize
 */

import { initRag } from './services/rag.js';
import path from 'path';
import fs from 'fs';

async function initializeServices() {
  console.log('🚀 Initializing services...');
  
  // Create necessary directories if they don't exist
  const dataDir = path.join(process.cwd(), 'data');
  const uploadsDir = path.join(dataDir, 'uploads');
  const summariesDir = path.join(dataDir, 'summaries');

  // Ensure directories exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
  if (!fs.existsSync(summariesDir)) {
    fs.mkdirSync(summariesDir);
  }

  try {
    console.log('🔄 Initializing RAG system...');
    const success = await initRag();
    if (success) {
      console.log('✅ RAG system initialized successfully');
    } else {
      console.warn('⚠️ RAG system initialization completed with warnings');
    }
  } catch (error) {
    console.error('❌ Failed to initialize RAG system:', error);
    // Don't crash the server if RAG fails to initialize
    console.log('ℹ️ Continuing without RAG functionality');
  }
}

export { initializeServices };
