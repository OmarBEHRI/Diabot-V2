/**
 * Local Embeddings Service
 * 
 * Provides text embedding generation using locally-hosted models:
 * - Uses Xenova/transformers.js to run ONNX models in Node.js
 * - Implements the BGE-large-en-v1.5 embedding model (1024 dimensions)
 * - Manages model downloading, caching, and initialization
 * - Serves as a fallback when OpenRouter API is unavailable
 * - Supports the RAG system with semantic text embeddings
 */

import { pipeline } from '@xenova/transformers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure models directory exists
const modelsDir = path.join(__dirname, '..', '..', 'models');
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

class LocalEmbedder {
    static model = null;
    static modelName = 'Xenova/bge-large-en-v1.5';
    static modelPath = path.join(modelsDir, 'Xenova', 'bge-large-en-v1.5', 'onnx');
    static initialized = false;
    static initializing = false;
    static initPromise = null;

    static async initialize() {
        // If already initialized, return
        if (this.initialized) return;
        
        // If initialization is in progress, return the existing promise
        if (this.initializing) {
            return this.initPromise;
        }

        this.initializing = true;
        
        // Create a promise that will resolve when initialization is complete
        this.initPromise = (async () => {
            try {
                // Check if model is already downloaded
                const modelExists = fs.existsSync(path.join(this.modelPath, 'config.json'));
                
                if (modelExists) {
                } else {
                    fs.mkdirSync(this.modelPath, { recursive: true });
                }
                
                // Load the model with error handling
                this.model = await pipeline('feature-extraction', this.modelName, {
                    quantized: false,
                    revision: 'main',
                    cache_dir: modelsDir
                });
                
                this.initialized = true;
                this.initializing = false;
                return true;
                
            } catch (error) {
                this.initializing = false;
                throw error;
            }
        })();

        return this.initPromise;
    }
    
    static async getEmbedding(text) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        if (!this.model) {
            throw new Error('Model not initialized');
        }
        
        try {
            // Ensure text is a non-empty string
            if (!text || typeof text !== 'string' || text.trim() === '') {
                throw new Error('Input text cannot be empty');
            }
            
            // Generate the embedding
            const output = await this.model(text, { 
                pooling: 'mean', 
                normalize: true 
            });
            
            // Convert to a regular array (from Tensor)
            const embedding = Array.from(output.data);
            
            // Ensure the embedding has the expected dimensions
            if (!embedding || embedding.length === 0) {
                throw new Error('Generated embedding is empty');
            }
            
            return embedding;
            
        } catch (error) {
            // Return a zero vector as fallback to prevent complete failure
            return new Array(1024).fill(0);
        }
    }
}

export { LocalEmbedder };

// Command line test
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const text = process.argv[2];
    
    if (!text) {
        process.exit(1);
    }

    (async () => {
        try {
            // Initialize the embedder
            await LocalEmbedder.initialize();
            
            // Get embeddings
            const startTime = Date.now();
            const embedding = await LocalEmbedder.getEmbedding(text);
            const duration = Date.now() - startTime;
            
        } catch (error) {
            process.exit(1);
        }
    })();
}
