/**
 * RAG (Retrieval-Augmented Generation) Service
 * 
 * Core service for the RAG system that provides:
 * - ChromaDB integration for vector database storage and retrieval
 * - Document loading and embedding generation
 * - Context retrieval for diabetes-related queries
 * - Fallback search mechanisms when ChromaDB is unavailable
 * - Source document tracking and metadata management
 */

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
      return { client: chromaClient, isInitialized: true };
    } catch (error) {
      return { client: null, isInitialized: false };
    }
  })();

  return chromaInitPromise;
}

// Initialize ChromaDB on first use
initializeChromaDB().catch(console.error);

// Function to load documents from the rag_sources directory
async function loadDocuments() {
  const summariesDir = path.join(__dirname, '..', '..', 'data', 'summaries'); // Changed to summaries directory
  // Ensure summariesDir exists before trying to read from it
  if (!fs.existsSync(summariesDir)) {
    fs.mkdirSync(summariesDir, { recursive: true }); // Create it if it doesn't exist
    return [];
  }
  const files = fs.readdirSync(summariesDir);
  
  const documents = [];
  
  for (const file of files) {
    if (file.endsWith('.txt') || file.endsWith('.md')) {
      const filePath = path.join(summariesDir, file);
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
    
    // Try to connect to ChromaDB and initialize collection
    const { client: chromaClient, isInitialized } = await initializeChromaDB();
    
    if (chromaClient && isInitialized) {
      try {
        const connectPromise = (async () => {
          try {
            try {
              console.log('[RAG_SERVICE] Attempting to delete collection: summaries_collection');
              await chromaClient.deleteCollection({ name: "summaries_collection" });
              console.log('[RAG_SERVICE] Successfully deleted existing collection: summaries_collection');
            } catch (e) {
              if (e.message && (e.message.includes('not found') || e.message.includes('404'))) {
                console.log('[RAG_SERVICE] Collection summaries_collection did not exist, which is fine.');
              } else {
                console.error('[RAG_SERVICE] Error deleting collection summaries_collection (and not a simple DNE error):', e);
              }
            }
            
            let col;
            try {
              console.log('[RAG_SERVICE] Attempting to create new collection: summaries_collection');
              col = await chromaClient.createCollection({
                name: "summaries_collection",
                metadata: { "hnsw:space": "cosine" }
              });
              console.log('[RAG_SERVICE] Successfully created new collection: summaries_collection');
              return col;
            } catch (createErr) {
              console.error('[RAG_SERVICE] CRITICAL: Failed to create collection summaries_collection:', createErr);
              throw createErr; // Re-throw to be caught by the outer promise handler
            }
          } catch (err) {
            console.error('[RAG_SERVICE] Error during ChromaDB collection setup (delete/create IIFE):', err);
            throw err; // Re-throw to be caught by Promise.race or the main try/catch
          }
        })();
        
        // Set a timeout of 5 seconds for the connection attempt
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('ChromaDB connection timeout')), 5000);
        });
        
        // Race the connection promise against the timeout
        collection = await Promise.race([connectPromise, timeoutPromise]);
        client = chromaClient; // Set the client for backward compatibility
        
        if (documents.length > 0) {
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
                embeddings.push(embedding);
              } catch (error) {
                embeddings.push(new Array(1536).fill(0));
              }
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Add documents to the collection (ChromaDB v2 format)
            await collection.add({
              ids: ids,
              embeddings: embeddings,
              metadatas: metadatas,
              documents: texts
            });
          }
        }
        
        isChromaAvailable = true;
      } catch (error) {
        console.error('[RAG_SERVICE] Overall failure during ChromaDB initialization or connection:', error);
        isChromaAvailable = false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Simple keyword-based search function as a fallback when ChromaDB is not available
 * This is less accurate than semantic search and should only be used as a fallback
 */
function simpleKeywordSearch(query, docs, topN = 10) {
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
export async function retrieveRelevantContext(queryText, topN = 3, includeAdjacent = false) {
  // Initialize RAG system if not already initialized
  if (!documents.length) {
    await initRag();
  }
  
  try {
    // Get ChromaDB client status
    const { client: chromaClient, isInitialized } = await initializeChromaDB();
    const isChromaReady = isInitialized && chromaClient && collection;
    
    // If ChromaDB is available, use it for semantic search
    if (isChromaReady) {
      try {
        // Initialize the embedder if not already done
        if (!isEmbedderInitialized) {
          try {
            await LocalEmbedder.initialize();
            isEmbedderInitialized = true;
          } catch (error) {
            throw new Error('Failed to initialize embedding model');
          }
        }

        // Get embedding for the query using the local model
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
            throw new Error('Invalid embedding format');
          }
        } catch (error) {
          throw new Error(`Failed to generate query embedding: ${error.message}`);
        }
        
        // Query the collection using the ChromaDB JS client, matching test_chromadb.js logic
        const results = await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: topN,
          include: ['metadatas', 'documents', 'distances']
        });
        
        if (!results || !results.ids || !results.ids[0]) {
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
                  const getRequest = {
                    ids: [chunkId],
                    include: ['documents', 'metadatas']
                  };
                  const result = await collection.get(getRequest);
                  
                  if (!result || !result.documents || result.documents.length === 0) {
                    return;
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
                }
              };
              
              await Promise.all([
                addAdjacentChunk(prevChunkId),
                addAdjacentChunk(nextChunkId)
              ]);
            }
          }
          
          contextChunks.sort((a, b) => {
            const aId = parseInt(a.id.split('_')[1]);
            const bId = parseInt(b.id.split('_')[1]);
            return aId - bId;
          });
          
          const context = contextChunks.map(chunk => {
            const sourceInfo = chunk.metadata?.source || 'Unknown';
            const pageInfo = chunk.metadata?.page || 'N/A';
            const chapterInfo = chunk.metadata?.chapter_title || 'N/A';
            
            const metaInfo = [
              `[Source: ${sourceInfo}`,
              `Page: ${pageInfo}`,
              `Chapter: ${chapterInfo}`,
              `Relevance: ${chunk.distance}${chunk.isAdjacent ? ' (Adjacent Chunk)' : ''}]`
            ].filter(Boolean).join(' | ');
            
            if (!chunk.isAdjacent) {
              const sourceObj = {
                text: chunk.text,
                source: sourceInfo,
                page: pageInfo,
                chapter: chapterInfo,
                score: typeof chunk.distance === 'string' ? parseFloat(chunk.distance) : chunk.distance
              };
              sources.push(sourceObj);
            }
            
            return `${metaInfo}\n${chunk.text}`;
          }).join("\n\n");
          
          return {
            context,
            sources
          };
        }
      } catch (error) {
      }
    }
    
    try {
      if (documents.length === 0) {
        documents = await loadDocuments();
      }
      
      if (documents.length === 0) {
        return { context: "", sources: [] };
      }
      
      const relevantDocs = simpleKeywordSearch(queryText, documents, topN);
      
      if (relevantDocs.length > 0) {
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

        return { context, sources };
      }

      return { context: "", sources: [] };
    } catch (error) {
      return { context: "", sources: [] };
    }
  } catch (error) {
    return { context: "", sources: [] };
  }
}