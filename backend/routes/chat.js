const express = require('express');
const { getDb } = require('../db');
const authMiddleware = require('../middleware/auth');
const { callOpenRouter, summarizeText } = require('../services/openrouter'); // Import summarizeText
const { retrieveRelevantContext } = require('../services/rag');
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

      // Get all messages for the session
      console.log('📋 [NEW SESSION] Retrieving all messages for the session (after initial message processing if any)...');
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
    if (session.title === 'Chat Summary Pending...') {
      console.log(`⏳ [MESSAGE] Session ${session_id} requires title generation. Current title: "${session.title}"`);
      try {
        const summarizedTitle = await summarizeText(content); // Use current user message for summary
        // Ensure summary is 3-5 words (this should ideally be handled in summarizeText prompt)
        currentTitle = summarizedTitle.split(' ').slice(0, 5).join(' '); 
        if (summarizedTitle.split(' ').length > 5) {
            const words = summarizedTitle.split(' ');
            if (words.length > 2) { // Only add ellipsis if there's something to truncate meaningfully
                 currentTitle = words.slice(0, 5).join(' ') + '...';
            } else {
                 currentTitle = words.join(' '); // Keep short titles as is
            }
        } else {
            currentTitle = summarizedTitle; // Use as is if already short enough
        }

        db.prepare('UPDATE chat_sessions SET title = ? WHERE id = ?').run(currentTitle, session_id);
        session.title = currentTitle; // Update session object in memory
        console.log(`✅ [MESSAGE] Session ${session_id} title updated to: "${currentTitle}"`);
      } catch (summaryErr) {
        console.error(`❌ [MESSAGE] Error generating summary for session ${session_id}:`, summaryErr);
        // Keep placeholder or a default error title if summarization fails
        // currentTitle remains 'Chat Summary Pending...' or could be set to 'Summary Error'
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
    const ragContext = await retrieveRelevantContext(content);
    console.log(`✅ [MESSAGE] RAG context retrieved for session ${session_id}`);

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
    for (const msg of history) {
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
    res.json({
      session_id,
      title: currentTitle, // Use the potentially updated title
      model: model.display_name,
      topic: topic.name,
      messages: updated_messages
    });
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

module.exports = router;
