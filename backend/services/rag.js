const fs = require('fs');
const path = require('path');
const { ChromaClient } = require('chromadb');
const { getEmbedding, isApiKeySet } = require('./openrouter');

// Initialize ChromaDB
let client;
let collection;
let isChromaAvailable = false;
let documents = [];

// Try to initialize ChromaDB client
try {
  client = new ChromaClient();
  console.log('ChromaDB client initialized');
} catch (error) {
  console.warn('Failed to initialize ChromaDB client, will use fallback mode:', error.message);
}

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
async function initRag() {
  try {
    // Load documents regardless of ChromaDB availability
    documents = await loadDocuments();
    console.log(`Loaded ${documents.length} documents from files`);
    
    // Try to connect to ChromaDB and initialize collection
    if (client) {
      try {
        console.log('Attempting to connect to ChromaDB...');
        // Set a timeout for the ChromaDB connection attempt
        const connectPromise = new Promise(async (resolve, reject) => {
          try {
            // Create or get the collection
            collection = await client.getOrCreateCollection({
              name: "medical_docs",
            });
            resolve(collection);
          } catch (err) {
            reject(err);
          }
        });
        
        // Set a timeout of 5 seconds for the connection attempt
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('ChromaDB connection timeout')), 5000);
        });
        
        // Race the connection promise against the timeout
        collection = await Promise.race([connectPromise, timeoutPromise]);
        
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
                const embedding = await getEmbedding(text);
                embeddings.push(embedding);
              } catch (error) {
                console.error(`Error getting embedding for text: ${text.substring(0, 50)}...`);
                // Use a placeholder embedding if there's an error
                embeddings.push(new Array(1536).fill(0));
              }
              // Add a small delay to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Add documents to the collection
            await collection.add({
              ids,
              embeddings,
              metadatas,
              documents: texts,
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

// Function to retrieve relevant context for a query
async function retrieveRelevantContext(queryText, topN = 3) {
  // Initialize RAG system if not already initialized
  if (!documents.length) {
    await initRag();
  }
  
  try {
    console.log(`Retrieving context for query: ${queryText.substring(0, 50)}...`);
    
    // If ChromaDB is available, use it for semantic search
    if (isChromaAvailable && collection) {
      console.log('Using ChromaDB for semantic search');
      try {
        // Get embedding for the query
        const queryEmbedding = await getEmbedding(queryText);
        
        // Query the collection
        const results = await collection.query({
          queryEmbeddings: [queryEmbedding],
          nResults: topN,
        });
        
        // Format the results
        let context = "";
        if (results && results.documents && results.documents[0]) {
          context = results.documents[0].join("\n\n");
          console.log(`Retrieved ${results.documents[0].length} relevant documents from ChromaDB`);
          return context;
        }
      } catch (error) {
        console.warn('ChromaDB query failed, falling back to keyword search:', error.message);
        // Fall through to keyword search if ChromaDB query fails
      }
    }
    
    // Fallback: Use simple keyword matching if ChromaDB is not available
    console.log('Using fallback keyword search');
    const relevantDocs = simpleKeywordSearch(queryText, documents, topN);
    
    if (relevantDocs.length > 0) {
      const context = relevantDocs.map(doc => doc.text).join("\n\n");
      console.log(`Retrieved ${relevantDocs.length} relevant documents using keyword search`);
      return context;
    }
    
    console.log('No relevant context found');
    return "";
  } catch (error) {
    console.error("Error retrieving context:", error);
    return "";
  }
}

// Simple keyword-based search function as a fallback
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

module.exports = {
  initRag,
  retrieveRelevantContext
};
