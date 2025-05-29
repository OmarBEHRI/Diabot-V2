import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the database file
const dbPath = path.join(__dirname, 'data', 'diabot.db');

// Connect to the database
const db = new Database(dbPath, { readonly: true });

console.log('🔍 Inspecting database schema...\n');

// Function to get table info
function inspectTable(tableName) {
  console.log(`📋 Table: ${tableName}`);
  
  try {
    // Get table columns
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    console.log('\nColumns:');
    console.table(columns);
    
    // Get indexes
    const indexes = db.prepare(`PRAGMA index_list(${tableName})`).all();
    if (indexes.length > 0) {
      console.log('\nIndexes:');
      for (const idx of indexes) {
        const indexInfo = db.prepare(`PRAGMA index_info(${idx.name})`).all();
        console.log(`- ${idx.name} (${indexInfo.map(i => i.name).join(', ')})`);
      }
    }
    
    // Get row count
    const rowCount = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;
    console.log(`\nTotal rows: ${rowCount}`);
    
    // Show a few sample rows if they exist
    if (rowCount > 0) {
      const sampleRows = db.prepare(`
        SELECT * FROM ${tableName} 
        ORDER BY id DESC 
        LIMIT 3
      `).all();
      
      console.log('\nSample rows (most recent first):');
      console.table(sampleRows.map(row => {
        const r = { ...row };
        // Truncate long text fields for better readability
        if (r.content && r.content.length > 50) {
          r.content = r.content.substring(0, 50) + '...';
        }
        if (r.sources && r.sources.length > 50) {
          r.sources = r.sources.substring(0, 50) + '...';
        }
        return r;
      }));
    }
    
  } catch (error) {
    console.error(`❌ Error inspecting table ${tableName}:`, error.message);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

// Inspect relevant tables
inspectTable('chat_messages');
inspectTable('chat_sessions');

// Close the database connection
db.close();

console.log('✅ Database inspection complete.');
