import { getDb } from './db.js';

// Get database connection
const db = getDb();

console.log('🔄 Updating models in the database...');

// 1. Remove outdated models (Claude Instant and Mistral 7B)
try {
  const deleteResult = db.prepare('DELETE FROM models WHERE openrouter_id LIKE ? OR openrouter_id LIKE ?')
    .run('%claude-instant%', '%mistral-7b-instruct%');
  
  console.log(`✅ Removed ${deleteResult.changes} outdated models`);
} catch (error) {
  console.error('❌ Error removing outdated models:', error);
}

// 2. Add updated models
try {
  // Add newer models to replace the removed ones
  const newModels = [
    {
      openrouter_id: 'anthropic/claude-3-haiku',
      display_name: 'Claude 3 Haiku',
      accuracy_no_rag: 0.78,
      accuracy_rag: 0.89,
      description: 'Fast and accurate for medical questions'
    },
    {
      openrouter_id: 'google/gemini-1.5-pro',
      display_name: 'Gemini 1.5 Pro',
      accuracy_no_rag: 0.76,
      accuracy_rag: 0.88,
      description: 'Advanced model with strong medical knowledge'
    }
  ];

  const insertModel = db.prepare('INSERT INTO models (openrouter_id, display_name, accuracy_no_rag, accuracy_rag, description) VALUES (?, ?, ?, ?, ?)');
  
  for (const model of newModels) {
    insertModel.run(
      model.openrouter_id, 
      model.display_name, 
      model.accuracy_no_rag, 
      model.accuracy_rag, 
      model.description
    );
  }
  
  console.log(`✅ Added ${newModels.length} new models`);
} catch (error) {
  console.error('❌ Error adding new models:', error);
}

// 3. List all current models for verification
try {
  const currentModels = db.prepare('SELECT * FROM models').all();
  console.log('📋 Current models in database:');
  currentModels.forEach(model => {
    console.log(`- ${model.id}: ${model.display_name} (${model.openrouter_id})`);
  });
} catch (error) {
  console.error('❌ Error listing current models:', error);
}

console.log('✅ Model update completed');
