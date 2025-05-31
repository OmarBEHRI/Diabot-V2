import { getDb } from '../db.js';

// Define the additional models to add
const additionalModels = [
  {
    id: 1001,
    openrouter_id: "google/gemini-2.5-flash-preview-05-20",
    display_name: "Gemini 2.5 Flash",
    accuracy_no_rag: 0.92,
    accuracy_rag: 0.95,
    description: "Google's Gemini 2.5 Flash model"
  },
  {
    id: 1002,
    openrouter_id: "openai/gpt-4.1-mini",
    display_name: "GPT-4.1 Mini",
    accuracy_no_rag: 0.91,
    accuracy_rag: 0.94,
    description: "OpenAI's GPT-4.1 Mini model"
  },
  {
    id: 1003,
    openrouter_id: "openai/gpt-4o-mini",
    display_name: "GPT-4o Mini",
    accuracy_no_rag: 0.93,
    accuracy_rag: 0.96,
    description: "OpenAI's GPT-4o Mini model"
  },
  {
    id: 1004,
    openrouter_id: "deepseek/deepseek-chat-v3-0324",
    display_name: "DeepSeek Chat v3",
    accuracy_no_rag: 0.89,
    accuracy_rag: 0.92,
    description: "DeepSeek's Chat v3 model"
  },
  {
    id: 1005,
    openrouter_id: "mistralai/mistral-nemo",
    display_name: "Mistral Nemo",
    accuracy_no_rag: 0.90,
    accuracy_rag: 0.93,
    description: "Mistral AI's Nemo model"
  },
  {
    id: 1006,
    openrouter_id: "google/gemma-3-4b-it",
    display_name: "Gemma 3 4B",
    accuracy_no_rag: 0.88,
    accuracy_rag: 0.91,
    description: "Google's Gemma 3 4B model"
  },
  {
    id: 1007,
    openrouter_id: "meta-llama/llama-3.1-8b-instruct",
    display_name: "Llama 3.1 8B",
    accuracy_no_rag: 0.89,
    accuracy_rag: 0.92,
    description: "Meta's Llama 3.1 8B model"
  },
  {
    id: 1008,
    openrouter_id: "meta-llama/llama-4-scout",
    display_name: "Llama 4 Scout",
    accuracy_no_rag: 0.94,
    accuracy_rag: 0.97,
    description: "Meta's Llama 4 Scout model"
  }
];

function addNewModels() {
  const db = getDb();
  console.log('Adding new models to the database...');
  
  // Start a transaction
  db.prepare('BEGIN').run();
  
  try {
    // Prepare the statement for inserting or updating models
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO models 
      (id, openrouter_id, display_name, accuracy_no_rag, accuracy_rag, description) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    // Insert each model
    for (const model of additionalModels) {
      // Check if model already exists by ID
      const existingModel = db.prepare('SELECT id FROM models WHERE id = ?').get(model.id);
      
      if (existingModel) {
        console.log(`Model with ID ${model.id} (${model.display_name}) already exists. Updating...`);
      } else {
        console.log(`Adding new model: ${model.display_name} (ID: ${model.id})`);
      }
      
      // Insert or replace the model
      stmt.run(
        model.id,
        model.openrouter_id,
        model.display_name,
        model.accuracy_no_rag,
        model.accuracy_rag,
        model.description
      );
    }
    
    // Commit the transaction
    db.prepare('COMMIT').run();
    console.log('Successfully added/updated all new models.');
  } catch (error) {
    // Rollback in case of error
    db.prepare('ROLLBACK').run();
    console.error('Error adding new models:', error);
  }
}

// Run the migration
addNewModels();
