import express from 'express';
import { getDb } from '../db.js';
import authMiddleware from '../middleware/auth.js';
import { callOpenRouter, summarizeText } from '../services/openrouter.js';
import { retrieveRelevantContext } from '../services/rag.js';

const router = express.Router();

// Protect all chat routes with authentication
router.use(authMiddleware);

// Create a new chat session
router.post('/new_session', async (req, res) => {
  console.log('🔵 [NEW SESSION] Received request. Body:', JSON.stringify(req.body, null, 2));
  
  const { model_id, topic_id, initial_message_content } = req.body;
  const user_id = req.user.id;

  if (!model_id || !topic_id) {
    console.log('❌ [NEW SESSION] Missing required fields: model_id or topic_id. Body:', JSON.stringify(req.body, null, 2));
    return res.status(400).json({ error: 'Missing required fields: model_id or topic_id' });
  }

  const db = getDb();

  try {
    // Get model information
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(model_id);
    if (!model) {
      console.log(`❌ Model with ID ${model_id} not found`);
      return res.status(404).json({ error: 'Model not found' });
    }
    console.log(`✅ [NEW SESSION] Initial model for session: ${model.display_name} (ID: ${model_id})`);

    // Get topic information
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic_id);
    if (!topic) {
      console.log(`❌ Topic with ID ${topic_id} not found`);
      return res.status(404).json({ error: 'Topic not found' });
    }
    console.log(`✅ [NEW SESSION] Initial topic for session: ${topic.name} (ID: ${topic_id})`);

    // Set a placeholder title; actual summary will be generated on first user message
    const title = "Chat Summary Pending...";
    console.log(`ℹ️ [NEW SESSION] Set placeholder title: "${title}"`);

    // Create a new chat session
    console.log('💾 [NEW SESSION] Creating new session in database with placeholder title:', title);
    const sessionResult = db.prepare(
      'INSERT INTO chat_sessions (user_id, model_id, topic_id, title) VALUES (?, ?, ?, ?)'
    ).run(user_id, model_id, topic_id, title);

    const session_id = sessionResult.lastInsertRowid;
    console.log(`✅ [NEW SESSION] Created new session with ID: ${session_id}`);
    let messages_db = []; // Initialize messages_db

    if (initial_message_content && initial_message_content.trim() !== '') {
      console.log('💬 [NEW SESSION] Processing initial message from user (if provided)...');
      // Store the initial user message
      db.prepare(
        'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
      ).run(session_id, 'user', initial_message_content);

      // Retrieve relevant context using RAG
      console.log('🔍 [NEW SESSION] Retrieving relevant context using RAG for initial message...');
      const ragContext = await retrieveRelevantContext(initial_message_content);
      console.log('✅ [NEW SESSION] Retrieved RAG context for initial message');

      // Construct prompt with RAG context
      const messages = [
        {
          role: 'system',
          content: `You are a medical assistant specialized in ${topic.name}. 
                   Provide accurate, helpful information based on medical knowledge.
                   If you're unsure, acknowledge the limitations and suggest consulting a healthcare professional.
                   Here is some relevant medical information that may help with the query:
                   ${ragContext}`
        },
        { role: 'user', content: initial_message_content }
      ];

      // Call OpenRouter API
      console.log(`🤖 [NEW SESSION] Calling OpenRouter API with model: ${model.openrouter_id} for initial message...`);
      const assistantResponse = await callOpenRouter(model.openrouter_id, messages);
      console.log('✅ [NEW SESSION] Received response from OpenRouter for initial message');

      // Store the assistant's response
      console.log('💾 [NEW SESSION] Storing assistant response in database for initial message...');
      db.prepare(
        'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
      ).run(session_id, 'assistant', assistantResponse);

      // Generate a summary from the initial message
      console.log('📝 [NEW SESSION] Generating summary from initial message...');
      let title; // Declare title with let to allow reassignment
      try {
        const summary = await summarizeText(initial_message_content);
        console.log(`✅ [NEW SESSION] Generated summary: "${summary}"`);
        
        // Update the session with the generated summary
        db.prepare(
          'UPDATE chat_sessions SET title = ? WHERE id = ?'
        ).run(summary, session_id);
        console.log(`✅ [NEW SESSION] Updated session ${session_id} with summary title`);
        
        // Update the title to be used in the response
        title = summary;
      } catch (summaryErr) {
        console.error('❌ [NEW SESSION] Error generating summary:', summaryErr);
        // Fallback to first few words of the message if summary fails
        const fallbackTitle = initial_message_content.split(' ').slice(0, 5).join(' ');
        db.prepare(
          'UPDATE chat_sessions SET title = ? WHERE id = ?'
        ).run(fallbackTitle, session_id);
        console.log(`⚠️ [NEW SESSION] Using fallback title: "${fallbackTitle}"`);
        title = fallbackTitle;
      }

      // Get all messages for the session
      console.log('📋 [NEW SESSION] Retrieving all messages for the session...');
      messages_db = db.prepare(
        'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC'
      ).all(session_id);
      console.log(`✅ [NEW SESSION] Retrieved ${messages_db.length} messages`);
    }

    console.log(`✅ [NEW SESSION] Responding for session ${session_id}. Title: ${title}, Model: ${model.display_name}, Topic: ${topic.name}`);
    res.json({
      session_id,
      title,
      model: model.display_name,
      topic: topic.name,
      messages: messages_db
    });
  } catch (err) {
    console.error('❌ [NEW SESSION] Error creating new session:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message to an existing chat session
router.post('/:sessionId/message', async (req, res) => {
  console.log('🔵 [MESSAGE] Received request. Session ID:', req.params.sessionId, 'Body:', JSON.stringify(req.body, null, 2));
  const { content, model_id, topic_id } = req.body; // model_id and topic_id are now dynamic
  const session_id = req.params.sessionId;
  const user_id = req.user.id;

  if (!content || !model_id || !topic_id) {
    console.log('❌ [MESSAGE] Missing required fields: content, model_id, or topic_id. Body:', JSON.stringify(req.body, null, 2));
    return res.status(400).json({ error: 'Message content, model_id, and topic_id are required' });
  }



  const db = getDb();

  try {
    // Verify user owns the session
    const session = db.prepare(
      'SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?'
    ).get(session_id, user_id);

    if (!session) {
      return res.status(404).json({ error: 'Chat session not found or unauthorized' });
    }

    // Get model and topic information using dynamic IDs from request body
    console.log(`🔄 [MESSAGE] Using dynamic model_id: ${model_id} and topic_id: ${topic_id} from request for session ${session_id}`);
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(model_id);
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic_id);

    if (!model) {
      console.log(`❌ [MESSAGE] Dynamic Model with ID ${model_id} not found for session ${session_id}`);
      return res.status(404).json({ error: 'Model not found' });
    }
    console.log(`✅ [MESSAGE] Using dynamic model: ${model.display_name} for session ${session_id}`);

    if (!topic) {
      console.log(`❌ [MESSAGE] Dynamic Topic with ID ${topic_id} not found for session ${session_id}`);
      return res.status(404).json({ error: 'Topic not found' });
    }
    console.log(`✅ [MESSAGE] Using dynamic topic: ${topic.name} for session ${session_id}`);

    // Store the user message
    console.log(`💬 [MESSAGE] Storing user message for session ${session_id}`);
    db.prepare(
      'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
    ).run(session_id, 'user', content);
    console.log(`✅ [MESSAGE] User message stored for session ${session_id}`);

    // Check if summary needs to be generated (i.e., title is placeholder)
    let currentTitle = session.title;
    const isPlaceholderTitle = session.title === 'Chat Summary Pending...' || session.title === 'New Chat';
    
    if (isPlaceholderTitle) {
      console.log(`⏳ [MESSAGE] Session ${session_id} requires title generation. Current title: "${session.title}"`);
      console.log(`📝 [MESSAGE] Generating title from message: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
      
      try {
        // Generate the summary using the summarizeText function
        const summarizedTitle = await summarizeText(content);
        console.log(`📌 [MESSAGE] Generated title: "${summarizedTitle}"`);
        
        // Clean up the title (remove any extra whitespace, newlines, etc.)
        currentTitle = summarizedTitle
          .replace(/[\n\r]+/g, ' ')  // Replace newlines with spaces
          .trim()                     // Remove leading/trailing spaces
          .replace(/\s+/g, ' ');      // Replace multiple spaces with single space
          
        // Ensure title is not too long (max 50 chars)
        if (currentTitle.length > 50) {
          currentTitle = currentTitle.substring(0, 47) + '...';
        }
        
        console.log(`🔄 [MESSAGE] Updating session ${session_id} title to: "${currentTitle}"`);
        
        // Update the session title in the database
        const updateStmt = db.prepare('UPDATE chat_sessions SET title = ? WHERE id = ?');
        const updateResult = updateStmt.run(currentTitle, session_id);
        
        if (updateResult.changes > 0) {
          console.log(`✅ [MESSAGE] Successfully updated session ${session_id} title to: "${currentTitle}"`);
          session.title = currentTitle; // Update session object in memory
        } else {
          console.error(`❌ [MESSAGE] Failed to update session title in database. Changes: ${updateResult.changes}`);
        }
      } catch (summaryErr) {
        console.error(`❌ [MESSAGE] Error generating/updating summary for session ${session_id}:`, summaryErr);
        // Fallback to a default title based on the first few words
        const fallbackTitle = content.split(' ').slice(0, 5).join(' ');
        currentTitle = fallbackTitle.length > 0 ? fallbackTitle : 'New Chat';
        console.log(`⚠️ [MESSAGE] Using fallback title: "${currentTitle}"`);
        
        // Still try to update the database with the fallback title
        try {
          db.prepare('UPDATE chat_sessions SET title = ? WHERE id = ?').run(currentTitle, session_id);
          session.title = currentTitle;
        } catch (dbErr) {
          console.error(`❌ [MESSAGE] Failed to update session title with fallback:`, dbErr);
        }
      }
    }

    // Get conversation history (last 10 messages)
    console.log(`📜 [MESSAGE] Retrieving conversation history (last 10 messages) for session ${session_id}`);
    const history = db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10'
    ).all(session_id);
    console.log(`✅ [MESSAGE] Retrieved ${history.length} messages for history for session ${session_id}`);
    
    // Reverse to get chronological order
    history.reverse();

    // Retrieve relevant context using RAG
    console.log(`🔍 [MESSAGE] Retrieving RAG context for user message in session ${session_id}`);
    const { context: ragContext, sources } = await retrieveRelevantContext(content);
    console.log(`✅ [MESSAGE] RAG context retrieved for session ${session_id} with ${sources.length} sources`);

    // Construct messages array with system message, conversation history, and new message
    const messages = [
      {
        role: 'system',
        content: `You are a medical assistant specialized in ${topic.name}. 
                 Provide accurate, helpful information based on medical knowledge.
                 If you're unsure, acknowledge the limitations and suggest consulting a healthcare professional.
                 Here is some relevant medical information that may help with the query:
                 ${ragContext}`
      }
    ];

    // Add conversation history
    console.log(`➕ [MESSAGE] Adding ${history.length} historical messages to prompt for session ${session_id}`);
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // Call OpenRouter API
    console.log(`🤖 [MESSAGE] Calling OpenRouter API with dynamic model ${model.openrouter_id} for session ${session_id}`);
    const assistantResponse = await callOpenRouter(model.openrouter_id, messages);
    console.log(`✅ [MESSAGE] Received response from OpenRouter for session ${session_id}`);

    // Store the assistant's response
    console.log(`💾 [MESSAGE] Storing assistant response for session ${session_id}`);
    db.prepare(
      'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
    ).run(session_id, 'assistant', assistantResponse);
    console.log(`✅ [MESSAGE] Assistant response stored for session ${session_id}`);

    // Get updated messages
    console.log(`🔄 [MESSAGE] Retrieving all updated messages for session ${session_id}`);
    const updated_messages = db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(session_id);
    console.log(`✅ [MESSAGE] Retrieved ${updated_messages.length} total messages for session ${session_id}`);

    console.log(`✅ [MESSAGE] Responding for session ${session_id}. Title: ${currentTitle}, Model: ${model.display_name}, Topic: ${topic.name}`);
    
    // Prepare the response with sources
    const response = {
      session_id,
      title: currentTitle, // Use the potentially updated title
      model: model.display_name,
      topic: topic.name,
      messages: updated_messages.map(msg => ({
        ...msg,
        // Add sources to the assistant's response
        sources: msg.role === 'assistant' && msg.id === updated_messages[updated_messages.length - 1].id 
          ? sources 
          : []
      }))
    };
    
    console.log(`📤 [MESSAGE] Sending response with ${sources.length} sources for session ${session_id}`);
    res.json(response);
  } catch (err) {
    console.error(`❌ [MESSAGE] Error processing message for session ${session_id}:`, err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all chat sessions for the user
router.get('/sessions', (req, res) => {
  const user_id = req.user.id;
  const db = getDb();

  try {
    const sessions = db.prepare(`
      SELECT cs.*, m.display_name as model_name, t.name as topic_name
      FROM chat_sessions cs
      JOIN models m ON cs.model_id = m.id
      JOIN topics t ON cs.topic_id = t.id
      WHERE cs.user_id = ?
      ORDER BY cs.created_at DESC
    `).all(user_id);

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all messages for a specific chat session
router.get('/:sessionId/messages', (req, res) => {
  const session_id = req.params.sessionId;
  const user_id = req.user.id;
  const db = getDb();

  try {
    // Verify user owns the session
    const session = db.prepare(
      'SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?'
    ).get(session_id, user_id);

    if (!session) {
      return res.status(404).json({ error: 'Chat session not found or unauthorized' });
    }

    // Get all messages for the session
    const messages = db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(session_id);

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a chat session
router.delete('/sessions/:sessionId', (req, res) => {
  const session_id = req.params.sessionId;
  const user_id = req.user.id;
  const db = getDb();

  try {
    // Verify user owns the session
    const session = db.prepare(
      'SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?'
    ).get(session_id, user_id);

    if (!session) {
      return res.status(404).json({ error: 'Chat session not found or unauthorized' });
    }

    // Delete messages associated with the session
    db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(session_id);

    // Delete the chat session
    db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(session_id);

    res.status(204).send(); // No content to send back
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
