import { initRag } from './services/rag.js';

async function initializeServices() {
  console.log('🚀 Initializing services...');
  
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
