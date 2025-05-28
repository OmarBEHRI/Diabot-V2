const fs = require('fs');
const path = require('path');
const { ChromaClient, OpenAIEmbeddingFunction } = require('chromadb');
const { getEmbedding } = require('./openrouter');

// Initialize ChromaDB
const client = new ChromaClient();
let collection;

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
    // Create or get the collection
    collection = await client.getOrCreateCollection({
      name: "medical_docs",
    });
    
    // Check if collection is empty
    const count = await collection.count();
    
    if (count === 0) {
      console.log("Collection is empty, loading documents...");
      const documents = await loadDocuments();
      
      if (documents.length > 0) {
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
      } else {
        console.log("No documents found in rag_sources directory");
      }
    } else {
      console.log(`Collection already contains ${count} documents`);
    }
    
    return true;
  } catch (error) {
    console.error("Error initializing RAG system:", error);
    return false;
  }
}

// Function to retrieve relevant context for a query
async function retrieveRelevantContext(queryText, topN = 3) {
  if (!collection) {
    await initRag();
  }
  
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
    }
    
    return context;
  } catch (error) {
    console.error("Error retrieving context:", error);
    return "";
  }
}

module.exports = {
  initRag,
  retrieveRelevantContext
};
