import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ChromaClient } from 'chromadb';
import { LocalEmbedder } from './localEmbeddings.js';

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize ChromaDB and Embeddings
let isChromaInitialized = false;
let isEmbedderInitialized = false;

let client = null;
let collection = null;
let isChromaAvailable = false;
let documents = [];
let chromaInitPromise = null;

// Function to initialize ChromaDB client
async function initializeChromaDB() {
  if (chromaInitPromise) {
    return chromaInitPromise;
  }

  chromaInitPromise = (async () => {
    try {
      console.log('🔌 Connecting to ChromaDB server...');
      const chromaClient = new ChromaClient({
        path: 'http://localhost:8000',
        fetchOptions: {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        }
      });
      
      // Set the API version to v2
      chromaClient.API = chromaClient.API || {};
      chromaClient.API.VERSION = 'v2';
      
      // Test connection
      await chromaClient.heartbeat();
      console.log('✅ ChromaDB client connected successfully');
      return { client: chromaClient, isInitialized: true };
    } catch (error) {
      console.warn('⚠️ Failed to initialize ChromaDB client, will use fallback mode:', error.message);
      return { client: null, isInitialized: false };
    }
  })();

  return chromaInitPromise;
}

// Initialize ChromaDB on first use
initializeChromaDB().catch(console.error);

// Function to load documents from the rag_sources directory
async function loadDocuments() {
  const ragSourcesDir = path.join(__dirname, '..', '..', 'data', 'rag_sources');
  const files = fs.readdirSync(ragSourcesDir);
  
  const documents = [];
  
  for (const file of files) {
    if (file.endsWith('.txt') || file.endsWith('.md')) {
      const filePath = path.join(ragSourcesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Simple chunking by paragraphs
      const paragraphs = content.split(/\n\s*\n/);
      
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();
        if (paragraph.length > 20) { // Only include non-empty paragraphs
          documents.push({
            id: `${file.replace(/\.[^/.]+$/, '')}_${i}`,
            text: paragraph,
            metadata: {
              source: file,
              chunk: i
            }
          });
        }
      }
    }
  }
  
  return documents;
}

// Initialize the RAG system
export async function initRag() {
  try {
    // Load documents regardless of ChromaDB availability
    documents = await loadDocuments();
    console.log(`Loaded ${documents.length} documents from files`);
    
    // Try to connect to ChromaDB and initialize collection
    const { client: chromaClient, isInitialized } = await initializeChromaDB();
    
    if (chromaClient && isInitialized) {
      try {
        console.log('Attempting to connect to ChromaDB...');
        // Set a timeout for the ChromaDB connection attempt
        const connectPromise = (async () => {
          try {
            // Create or get the collection
            let col;
            try {
              col = await chromaClient.getCollection({ name: "diabetes_textbook" });
              console.log('Using existing ChromaDB collection: diabetes_textbook');
            } catch (e) {
              console.log('Creating new ChromaDB collection: diabetes_textbook');
              col = await chromaClient.createCollection({ 
                name: "diabetes_textbook",
                metadata: { "hnsw:space": "cosine" }
              });
            }
            return col;
          } catch (err) {
            console.error('Error getting collection:', err);
            throw err;
          }
        })();
        
        // Set a timeout of 5 seconds for the connection attempt
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('ChromaDB connection timeout')), 5000);
        });
        
        // Race the connection promise against the timeout
        collection = await Promise.race([connectPromise, timeoutPromise]);
        client = chromaClient; // Set the client for backward compatibility
        
        // Check if collection is empty
        const count = await collection.count();
        console.log(`Connected to ChromaDB, collection has ${count} documents`);
        
        if (count === 0 && documents.length > 0) {
          console.log("Collection is empty, loading documents into ChromaDB...");
          
          // Process documents in batches to avoid API rate limits
          const batchSize = 10;
          for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);
            
            const ids = batch.map(doc => doc.id);
            const texts = batch.map(doc => doc.text);
            const metadatas = batch.map(doc => doc.metadata);
            
            // Get embeddings for the batch
            const embeddings = [];
            for (const text of texts) {
              try {
                const embedding = await LocalEmbedder.getEmbedding(text);
                console.log(`🔄 Using local embedding for text: ${text.substring(0, 30)}...`);
                embeddings.push(embedding);
              } catch (error) {
                console.error(`Error getting embedding for text: ${text.substring(0, 50)}...`);
                // Use a placeholder embedding if there's an error
                embeddings.push(new Array(1536).fill(0));
              }
              // Add a small delay to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Add documents to the collection (ChromaDB v2 format)
            await collection.add({
              ids: ids,
              embeddings: embeddings,
              metadatas: metadatas,
              documents: texts
            });
            
            console.log(`Added batch ${i/batchSize + 1}/${Math.ceil(documents.length/batchSize)}`);
          }
        }
        
        isChromaAvailable = true;
        console.log('ChromaDB setup completed successfully');
      } catch (error) {
        console.warn('Failed to connect to ChromaDB, using fallback mode:', error.message);
        isChromaAvailable = false;
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error initializing RAG system:", error);
    return false;
  }
}

/**
 * Simple keyword-based search function as a fallback when ChromaDB is not available
 * This is less accurate than semantic search and should only be used as a fallback
 */
function simpleKeywordSearch(query, docs, topN = 3) {
  // Extract keywords from the query (remove common words)
  const commonWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'as'];
  const keywords = query.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/) // Split by whitespace
    .filter(word => word.length > 2 && !commonWords.includes(word)); // Filter out common words and short words
  
  if (keywords.length === 0) {
    return [];
  }
  
  // Score each document based on keyword matches
  const scoredDocs = docs.map(doc => {
    const text = doc.text.toLowerCase();
    let score = 0;
    
    // Count keyword occurrences
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    
    return { ...doc, score };
  });
  
  // Sort by score (descending) and take top N
  const result = scoredDocs
    .filter(doc => doc.score > 0) // Only include docs with matches
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  
  return result;
}

// Function to retrieve relevant context for a query with metadata and adjacent chunks
export async function retrieveRelevantContext(queryText, topN = 3, includeAdjacent = true) {
  // Initialize RAG system if not already initialized
  if (!documents.length) {
    await initRag();
  }
  
  try {
    console.log(`Retrieving context for query: ${queryText.substring(0, 50)}...`);
    
    // Get ChromaDB client status
    const { client: chromaClient, isInitialized } = await initializeChromaDB();
    const isChromaReady = isInitialized && chromaClient && collection;
    
    // If ChromaDB is available, use it for semantic search
    if (isChromaReady) {
      console.log('Using ChromaDB for semantic search with collection: diabetes_textbook');
      try {
        // Initialize the embedder if not already done
        if (!isEmbedderInitialized) {
          console.log('🔄 Initializing embedding model...');
          try {
            await LocalEmbedder.initialize();
            isEmbedderInitialized = true;
            console.log('✅ Embedding model initialized successfully');
          } catch (error) {
            console.error('❌ Failed to initialize embedding model:', error);
            throw new Error('Failed to initialize embedding model');
          }
        }

        // Get embedding for the query using the local model
        console.log('🔄 Generating local embedding for query...');
        let queryEmbedding;
        try {
          // Ensure the text is properly formatted for the model
          const formattedQuery = queryText.trim();
          if (!formattedQuery) {
            throw new Error('Query text is empty');
          }
          
          // Add instruction for retrieval (same as in Python code)
          const instruction = 'Represent this sentence for searching relevant passages: ';
          queryEmbedding = await LocalEmbedder.getEmbedding(instruction + formattedQuery);
          
          if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length !== 1024) {
            console.warn('⚠️ Invalid embedding format, using fallback');
            throw new Error('Invalid embedding format');
          }
          
          console.log(`✅ Generated embedding with ${queryEmbedding.length} dimensions`);
        } catch (error) {
          console.error('❌ Error generating embedding:', error);
          throw new Error(`Failed to generate query embedding: ${error.message}`);
        }
        
        // Query the collection using the ChromaDB JS client, matching test_chromadb.js logic
        const results = await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: topN * 3,
          include: ['metadatas', 'documents', 'distances']
        });
        
        if (!results || !results.ids || !results.ids[0]) {
          console.warn('No results from ChromaDB query, using fallback');
          throw new Error('No results from ChromaDB');
        }
        
        // Format the results
        if (results && results.documents && results.documents[0]) {
          const contextChunks = [];
          const sources = [];
          const processedChunks = new Set();
          
          // Process each result and get adjacent chunks if needed
          for (let i = 0; i < Math.min(topN, results.documents[0].length); i++) {
            const docId = results.ids[0][i];
            const chunkIndex = parseInt(docId.split('_')[1]);
            const metadata = results.metadatas[0][i];
            const documentText = results.documents[0][i];
            const distance = results.distances && results.distances[0] ? 
                           (1 - results.distances[0][i]).toFixed(2) : 'N/A';
            
            // Skip if we've already processed this chunk
            if (processedChunks.has(docId)) continue;
            
            // Add the main chunk
            const chunkInfo = {
              id: docId,
              text: documentText,
              metadata: metadata,
              distance: distance,
              isAdjacent: false
            };
            
            // Add to context chunks
            contextChunks.push(chunkInfo);
            processedChunks.add(docId);
            
            // Get adjacent chunks if requested
            if (includeAdjacent) {
              // Get previous and next chunk IDs
              const baseId = docId.split('_')[0];
              const prevChunkId = `${baseId}_${chunkIndex - 1}`;
              const nextChunkId = `${baseId}_${chunkIndex + 1}`;
              
              // Helper function to add adjacent chunk
              const addAdjacentChunk = async (chunkId) => {
                if (processedChunks.has(chunkId)) return;
                
                try {
                  // Get adjacent chunk with v2 format
                  const getRequest = {
                    ids: [chunkId],
                    include: ['documents', 'metadatas']
                  };
                  console.log('Fetching chunk:', chunkId);
                  const result = await collection.get(getRequest);
                  
                  if (!result || !result.documents || result.documents.length === 0) {
                    console.log(`Chunk ${chunkId} not found in collection`);
                    return; // Skip if no document found
                  }
                  
                  if (result.ids && result.ids.length > 0) {
                    const adjChunk = {
                      id: chunkId,
                      text: result.documents[0],
                      metadata: result.metadatas[0],
                      distance: 'N/A',
                      isAdjacent: true
                    };
                    contextChunks.push(adjChunk);
                    processedChunks.add(chunkId);
                  }
                } catch (error) {
                  console.warn(`Could not retrieve adjacent chunk ${chunkId}:`, error.message);
                }
              };
              
              // Add adjacent chunks
              await Promise.all([
                addAdjacentChunk(prevChunkId),
                addAdjacentChunk(nextChunkId)
              ]);
            }
          }
          
          // Sort chunks by their ID to maintain document order
          contextChunks.sort((a, b) => {
            const aId = parseInt(a.id.split('_')[1]);
            const bId = parseInt(b.id.split('_')[1]);
            return aId - bId;
          });
          
          // Format the context and sources
          console.log('📝 Formatting context and sources...');
          const context = contextChunks.map(chunk => {
            // Add metadata header for each chunk
            const sourceInfo = chunk.metadata?.source || 'Unknown';
            const pageInfo = chunk.metadata?.page || 'N/A';
            const chapterInfo = chunk.metadata?.chapter_title || 'N/A';
            
            console.log(`🔍 Processing chunk - Source: ${sourceInfo}, Page: ${pageInfo}, Chapter: ${chapterInfo}, Distance: ${chunk.distance}`);
            
            const metaInfo = [
              `[Source: ${sourceInfo}`,
              `Page: ${pageInfo}`,
              `Chapter: ${chapterInfo}`,
              `Relevance: ${chunk.distance}${chunk.isAdjacent ? ' (Adjacent Chunk)' : ''}]`
            ].filter(Boolean).join(' | ');
            
            // Add to sources for citation
            if (!chunk.isAdjacent) {
              const sourceObj = {
                text: chunk.text,
                source: sourceInfo,
                page: pageInfo,
                chapter: chapterInfo,
                score: typeof chunk.distance === 'string' ? parseFloat(chunk.distance) : chunk.distance
              };
              console.log('📚 Adding source to citations:', JSON.stringify(sourceObj, null, 2));
              sources.push(sourceObj);
            }
            
            return `${metaInfo}\n${chunk.text}`;
          }).join("\n\n");
          
          console.log(`Retrieved ${results.documents[0].length} relevant documents from ChromaDB`);
          return {
            context,
            sources
          };
        }
      } catch (error) {
        console.warn('ChromaDB query failed, falling back to keyword search:', error.message);
        // Fall through to keyword search if ChromaDB query fails
      }
    }
    
    // Fallback: Use simple keyword matching if ChromaDB is not available
    console.log('Using fallback keyword search');
    try {
      // First try to load all documents if not already loaded
      if (documents.length === 0) {
        console.log('Loading documents for fallback search...');
        documents = await loadDocuments();
      }
      
      if (documents.length === 0) {
        console.warn('No documents available for fallback search');
        return { context: "", sources: [] };
      }
      
      console.log(`Searching through ${documents.length} documents for fallback search`);
      const relevantDocs = simpleKeywordSearch(queryText, documents, topN);
      
      if (relevantDocs.length > 0) {
        // Format the context with source information
        const context = relevantDocs.map(doc => {
          const sourceInfo = [
            `[Source: ${doc.metadata?.source || 'Unknown Source'}`,
            `Page: ${doc.metadata?.page || 'N/A'}`,
            `Chapter: ${doc.metadata?.chapter_title || 'N/A'}]`
          ].filter(Boolean).join(' | ');
          
          return `${sourceInfo}\n${doc.text}`;
        }).join("\n\n");
        
        const sources = relevantDocs.map(doc => ({
          text: doc.text,
          source: doc.metadata?.source || 'Unknown Source',
          page: doc.metadata?.page || 'N/A',
          chapter: doc.metadata?.chapter_title || 'N/A',
          score: 'N/A'
        }));

        console.log(`Retrieved ${relevantDocs.length} relevant documents using keyword search`);
        return { context, sources };
      }

      console.log('No relevant context found');
      return { context: "", sources: [] };
    } catch (error) {
      console.error('Error in fallback keyword search:', error);
      return { context: "", sources: [] };
    }
  } catch (error) {
    console.error('Error in retrieveRelevantContext:', error);
    return { context: "", sources: [] };
  }
}