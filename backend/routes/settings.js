/**
 * User Settings API Routes
 * 
 * Handles user preferences and application settings:
 * - Manages user profile information and credentials
 * - Controls default AI model selection for chat sessions
 * - Configures RAG system parameters (source count, etc.)
 * - Implements secure password updating with verification
 * - All routes are protected by authentication middleware
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';
import authMiddleware from '../middleware/auth.js';
import { ChromaClient } from 'chromadb';
import bcrypt from 'bcryptjs';

const router = express.Router();

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Protect all settings routes with authentication
router.use(authMiddleware);

// Get user settings
router.get('/', async (req, res) => {
  const user_id = req.user.id;
  const db = getDb();
  
  try {
    // Get user information
    const user = db.prepare('SELECT username, email, default_model_id, rag_source_count FROM users WHERE id = ?').get(user_id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get default model information if set
    let defaultModel = null;
    if (user.default_model_id) {
      defaultModel = db.prepare('SELECT id, display_name FROM models WHERE id = ?').get(user.default_model_id);
    }
    
    res.json({
      username: user.username,
      email: user.email || '',
      default_model: defaultModel,
      rag_source_count: user.rag_source_count || 10
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user settings
router.put('/', async (req, res) => {
  const user_id = req.user.id;
  const { username, email, currentPassword, newPassword } = req.body;
  const db = getDb();
  
  try {
    // Get current user data
    const user = db.prepare('SELECT username, password_hash FROM users WHERE id = ?').get(user_id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if username changes and if it's already taken
    if (username && username !== user.username) {
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, user_id);
      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password required' });
      }
      
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      
      // Update user with new password
      db.prepare(
        'UPDATE users SET password_hash = ? WHERE id = ?'
      ).run(hashedPassword, user_id);
    }

    // Update username and email if provided
    if (username || email !== undefined) {
      const updateFields = [];
      const params = [];

      if (username) {
        updateFields.push('username = ?');
        params.push(username);
      }
      
      if (email !== undefined) {
        updateFields.push('email = ?');
        params.push(email);
      }

      if (updateFields.length > 0) {
        params.push(user_id);
        db.prepare(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`
        ).run(...params);
      }
    }
    
    res.json({
      success: true,
      message: 'User settings updated successfully'
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Set default model
router.put('/default-model', (req, res) => {
  const user_id = req.user.id;
  const { model_id } = req.body;
  const db = getDb();
  
  try {
    if (!model_id) {
      return res.status(400).json({ error: 'Model ID is required' });
    }
    
    // Verify the model exists
    const model = db.prepare('SELECT id FROM models WHERE id = ?').get(model_id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    // Update user's default model
    db.prepare(
      'UPDATE users SET default_model_id = ? WHERE id = ?'
    ).run(model_id, user_id);
    
    res.json({
      success: true,
      message: 'Default model updated successfully'
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Set RAG sources count
router.put('/rag-sources', (req, res) => {
  const user_id = req.user.id;
  const { count } = req.body;
  const db = getDb();
  
  try {
    if (!count || isNaN(parseInt(count)) || parseInt(count) < 1 || parseInt(count) > 50) {
      return res.status(400).json({ error: 'Count must be a number between 1 and 50' });
    }
    
    const sourceCount = parseInt(count);
    
    // Update user's RAG source count
    db.prepare(
      'UPDATE users SET rag_source_count = ? WHERE id = ?'
    ).run(sourceCount, user_id);
    
    res.json({
      success: true,
      message: 'RAG source count updated successfully'
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete all chat history for user
router.delete('/chat-history', (req, res) => {
  const user_id = req.user.id;
  const db = getDb();
  
  try {
    // Begin a transaction
    db.prepare('BEGIN').run();
    
    try {
      // Get all session IDs for this user
      const sessions = db.prepare('SELECT id FROM chat_sessions WHERE user_id = ?').all(user_id);
      
      if (sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        
        // Delete all messages from these sessions
        for (const sessionId of sessionIds) {
          db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
        }
        
        // Delete all sessions
        db.prepare('DELETE FROM chat_sessions WHERE user_id = ?').run(user_id);
      }
      
      // Commit the transaction
      db.prepare('COMMIT').run();
      
      res.json({
        success: true,
        message: 'Chat history deleted successfully',
        count: sessions.length
      });
    } catch (err) {
      // Rollback in case of error
      db.prepare('ROLLBACK').run();
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Clear ChromaDB context (empty the collection)
router.delete('/chromadb', async (req, res) => {
  try {
    // Connect to ChromaDB
    const client = new ChromaClient({ path: 'http://localhost:8000' });
    
    // Get collection
    try {
      // Try to delete the collection
      await client.deleteCollection({ name: 'diabetes_knowledge' });
      
      // Recreate the collection
      await client.createCollection({ name: 'diabetes_knowledge' });
      
      res.json({
        success: true,
        message: 'ChromaDB context cleared successfully'
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to clear ChromaDB: ' + err.message });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to connect to ChromaDB: ' + err.message });
  }
});

export default router;
