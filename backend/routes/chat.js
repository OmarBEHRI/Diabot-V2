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
  console.log('📝 Creating new chat session with request body:', JSON.stringify(req.body, null, 2));
  const { model_id, topic_id, initial_message_content } = req.body;
  const user_id = req.user.id;

  if (!model_id || !topic_id) { // initial_message_content is now optional
    console.log('❌ Missing required fields in new session request');
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
    console.log(`✅ Using model: ${model.display_name}`);

    // Get topic information
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic_id);
    if (!topic) {
      console.log(`❌ Topic with ID ${topic_id} not found`);
      return res.status(404).json({ error: 'Topic not found' });
    }
    console.log(`✅ Using topic: ${topic.name}`);

    // Determine session title
    let title;
    if (initial_message_content && initial_message_content.trim() !== '') {
      console.log('🔍 Generating summary for initial message...');
      title = await summarizeText(initial_message_content); // Summarize the initial message
      console.log(`✅ Generated title: "${title}"`);
    } else {
      title = `${topic.name} - ${new Date().toLocaleString()}`; // Default title
      console.log(`ℹ️ Using default title: "${title}"`);
    }

    // Create a new chat session
    console.log('💾 Creating new session in database with title:', title);
    const sessionResult = db.prepare(
      'INSERT INTO chat_sessions (user_id, model_id, topic_id, title) VALUES (?, ?, ?, ?)'
    ).run(user_id, model_id, topic_id, title);

    const session_id = sessionResult.lastInsertRowid;
    console.log(`✅ Created new session with ID: ${session_id}`);
    let messages_db = []; // Initialize messages_db

    if (initial_message_content && initial_message_content.trim() !== '') {
      console.log('💬 Processing initial message from user...');
      // Store the initial user message
      db.prepare(
        'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
      ).run(session_id, 'user', initial_message_content);

      // Retrieve relevant context using RAG
      console.log('🔍 Retrieving relevant context using RAG...');
      const ragContext = await retrieveRelevantContext(initial_message_content);
      console.log('✅ Retrieved RAG context');

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
      console.log(`🤖 Calling OpenRouter API with model: ${model.openrouter_id}...`);
      const assistantResponse = await callOpenRouter(model.openrouter_id, messages);
      console.log('✅ Received response from OpenRouter');

      // Store the assistant's response
      console.log('💾 Storing assistant response in database...');
      db.prepare(
        'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
      ).run(session_id, 'assistant', assistantResponse);

      // Get all messages for the session
      console.log('📋 Retrieving all messages for the session...');
      messages_db = db.prepare(
        'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC'
      ).all(session_id);
      console.log(`✅ Retrieved ${messages_db.length} messages`);
    }

    res.json({
      session_id,
      title,
      model: model.display_name,
      topic: topic.name,
      messages: messages_db
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message to an existing chat session
router.post('/:sessionId/message', async (req, res) => {
  const { content } = req.body;
  const session_id = req.params.sessionId;
  const user_id = req.user.id;

  if (!content) {
    return res.status(400).json({ error: 'Message content is required' });
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

    // Get model and topic information
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(session.model_id);
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(session.topic_id);

    // Store the user message
    db.prepare(
      'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
    ).run(session_id, 'user', content);

    // Get conversation history (last 10 messages)
    const history = db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10'
    ).all(session_id);
    
    // Reverse to get chronological order
    history.reverse();

    // Retrieve relevant context using RAG
    const ragContext = await retrieveRelevantContext(content);

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
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // Call OpenRouter API
    const assistantResponse = await callOpenRouter(model.openrouter_id, messages);

    // Store the assistant's response
    db.prepare(
      'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
    ).run(session_id, 'assistant', assistantResponse);

    // Get updated messages
    const updated_messages = db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(session_id);

    res.json({
      session_id,
      title: session.title,
      model: model.display_name,
      topic: topic.name,
      messages: updated_messages
    });
  } catch (err) {
    console.error(err);
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
