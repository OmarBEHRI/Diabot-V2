/**
 * Database Service
 * 
 * Provides SQLite database initialization and access for the Diabot application:
 * - Creates and manages the database schema for users, models, topics, and chat sessions
 * - Initializes default models and topics for diabetes-related conversations
 * - Handles database connections and query execution
 * - Supports the 8 additional AI models (IDs 1001-1008) for enhanced capabilities
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const dbPath = path.join(dataDir, 'diabot.db');
let db;

function initDb() {
  db = new Database(dbPath);
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openrouter_id TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      accuracy_no_rag REAL,
      accuracy_rag REAL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      rag_filter_keywords TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      model_id INTEGER NOT NULL,
      topic_id INTEGER NOT NULL,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (model_id) REFERENCES models(id),
      FOREIGN KEY (topic_id) REFERENCES topics(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
      content TEXT NOT NULL,
      sources TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
  `);

  // Handle the updated_at column addition with a more robust check
  try {
    // Check if the column exists - use column_count instead of 'exists' which is a reserved keyword
    const columnCheck = db.prepare(`
      SELECT COUNT(*) as column_count 
      FROM pragma_table_info('chat_sessions') 
      WHERE name = 'updated_at'
    `).get();
    
    if (!columnCheck.column_count) {
      // Add the column if it doesn't exist
      db.prepare('ALTER TABLE chat_sessions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
      console.log('✅ Added updated_at column to chat_sessions');
    } else {
      console.log('ℹ️ updated_at column already exists in chat_sessions');
    }
  } catch (e) {
    console.error('Error checking/adding updated_at column:', e.message);
  }
  
  // Update existing rows to have a default updated_at
  try {
    db.prepare('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL').run();
  } catch (e) {
    console.error('Error updating chat_sessions:', e.message);
  }

  // Insert some default models
  const modelsCount = db.prepare('SELECT COUNT(*) as count FROM models').get();
  if (modelsCount.count === 0) {
    const defaultModels = [
      {
        openrouter_id: 'mistralai/mistral-7b-instruct',
        display_name: 'Mistral 7B Instruct',
        accuracy_no_rag: 0.65,
        accuracy_rag: 0.78,
        description: 'A balanced model with good performance and low cost'
      },
      {
        openrouter_id: 'anthropic/claude-instant-v1',
        display_name: 'Claude Instant',
        accuracy_no_rag: 0.72,
        accuracy_rag: 0.85,
        description: 'Fast and accurate for medical questions'
      },
      {
        openrouter_id: 'openai/gpt-3.5-turbo',
        display_name: 'GPT-3.5 Turbo',
        accuracy_no_rag: 0.70,
        accuracy_rag: 0.82,
        description: 'Good general knowledge and reasoning'
      }
    ];

    const insertModel = db.prepare('INSERT INTO models (openrouter_id, display_name, accuracy_no_rag, accuracy_rag, description) VALUES (?, ?, ?, ?, ?)');
    for (const model of defaultModels) {
      insertModel.run(model.openrouter_id, model.display_name, model.accuracy_no_rag, model.accuracy_rag, model.description);
    }
  }

  // Insert some default topics
  const topicsCount = db.prepare('SELECT COUNT(*) as count FROM topics').get();
  if (topicsCount.count === 0) {
    const defaultTopics = [
      {
        name: 'General Medicine',
        rag_filter_keywords: 'medicine,health,general,symptoms,diagnosis'
      },
      {
        name: 'Cardiology',
        rag_filter_keywords: 'heart,cardiac,cardiovascular,chest pain,arrhythmia'
      },
      {
        name: 'Pediatrics',
        rag_filter_keywords: 'children,pediatric,child,infant,newborn'
      },
      {
        name: 'Diabetes',
        rag_filter_keywords: 'diabetes,glucose,insulin,blood sugar,diabetic'
      }
    ];

    const insertTopic = db.prepare('INSERT INTO topics (name, rag_filter_keywords) VALUES (?, ?)');
    for (const topic of defaultTopics) {
      insertTopic.run(topic.name, topic.rag_filter_keywords);
    }
  }

  return db;
}

function getDb() {
  if (!db) {
    initDb();
  }
  return db;
}

export { initDb, getDb };