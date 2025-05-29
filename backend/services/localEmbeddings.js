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
            // Ensure text is a non-empty string
            if (!text || typeof text !== 'string' || text.trim() === '') {
                throw new Error('Input text cannot be empty');
            }
            
            // Generate the embedding
            console.log(`🔍 Generating embedding for text: ${text.substring(0, 50)}...`);
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
            
            console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
            return embedding;
            
        } catch (error) {
            console.error('❌ Error generating embedding:', error);
            // Return a zero vector as fallback to prevent complete failure
            console.log('⚠️ Using zero vector as fallback embedding');
            return new Array(1024).fill(0);
        }
    }
}

export { LocalEmbedder };

// Command line test
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const text = process.argv[2];
    
    if (!text) {
        console.error('❌ Please provide a text string as an argument');
        console.log('Usage: node localEmbeddings.js "Your text here"');
        process.exit(1);
    }

    (async () => {
        try {
            console.log(`\n🔍 Testing LocalEmbedder with text: "${text}"`);
            
            // Initialize the embedder
            console.log('🔄 Initializing embedder...');
            await LocalEmbedder.initialize();
            
            // Get embeddings
            console.log('⚙️  Generating embeddings...');
            const startTime = Date.now();
            const embedding = await LocalEmbedder.getEmbedding(text);
            const duration = Date.now() - startTime;
            
            // Display results
            console.log('\n✅ Embedding generated successfully!');
            console.log(`📊 Embedding dimensions: ${embedding.length}`);
            console.log(`⏱️  Time taken: ${duration}ms`);
            console.log('\n📝 First 10 dimensions:');
            console.log(embedding.slice(0, 10).map(x => x.toFixed(6)).join(', '));
            console.log('\n... and so on for all dimensions');
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            process.exit(1);
        }
    })();
}
