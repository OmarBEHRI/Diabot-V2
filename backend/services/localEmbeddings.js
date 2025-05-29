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
    console.log(`📁 Created models directory at: ${modelsDir}`);
}

class LocalEmbedder {
    static model = null;
    static modelName = 'Xenova/bge-large-en-v1.5';
    static modelPath = path.join(modelsDir, 'BAAI_bge-large-en-v1.5');
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

        console.log(`🔄 Initializing local embedding model: ${this.modelName}`);
        this.initializing = true;
        
        // Create a promise that will resolve when initialization is complete
        this.initPromise = (async () => {
            try {
                // Check if model is already downloaded
                const modelExists = fs.existsSync(path.join(this.modelPath, 'config.json'));
                
                if (modelExists) {
                    console.log('📦 Using locally cached model');
                } else {
                    console.log('📥 Model not found, downloading... (this may take a while, ~1.3GB)');
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
                console.log('✅ Local embedding model loaded successfully');
                return true;
                
            } catch (error) {
                console.error('❌ Error loading embedding model:', error);
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
            // Generate the embedding
            const output = await this.model(text, { pooling: 'mean', normalize: true });
            
            // Convert to a regular array (from Tensor)
            const embedding = Array.from(output.data);
            
            // Ensure the embedding has the expected dimensions
            if (!embedding || embedding.length === 0) {
                throw new Error('Generated embedding is empty');
            }
            
            return embedding;
            
        } catch (error) {
            console.error('❌ Error generating embedding:', error);
            throw new Error(`Failed to generate embedding: ${error.message}`);
        }
    }

    static async getEmbedding(text) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const output = await this.model(text, {
                pooling: 'mean',
                normalize: true,
            });
            
            // Convert to regular array (from Tensor)
            const embedding = Array.from(output.data);
            return embedding;
        } catch (error) {
            console.error('❌ Error generating embedding:', error);
            throw error;
        }
    }
}

export { LocalEmbedder };
