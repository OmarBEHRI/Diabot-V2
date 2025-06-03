/**
 * Chat API Routes
 * 
 * Handles all chat-related API endpoints including:
 * - Creating and managing chat sessions
 * - Processing messages with AI models
 * - Retrieving RAG context for diabetes-related queries
 * - Generating session titles and summaries
 * - Managing message history and source documents
 */

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
  const { model_id, topic_id, initial_message_content } = req.body;
  const user_id = req.user.id;

  if (!model_id || !topic_id) {
    return res.status(400).json({ error: 'Missing required fields: model_id or topic_id' });
  }

  const db = getDb();

  try {
    // Get model information
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(model_id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Get topic information
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic_id);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Set a placeholder title; actual summary will be generated on first user message
    const title = "New Session";

    // Create a new chat session
    const sessionResult = db.prepare(
      'INSERT INTO chat_sessions (user_id, model_id, topic_id, title) VALUES (?, ?, ?, ?)'
    ).run(user_id, model_id, topic_id, title);

    const session_id = sessionResult.lastInsertRowid;
    let messages_db = []; // Initialize messages_db

    if (initial_message_content && initial_message_content.trim() !== '') {
      // Store the initial user message
      db.prepare(
        'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
      ).run(session_id, 'user', initial_message_content);

      // Retrieve relevant context using RAG with metadata and adjacent chunks
      const { context: ragContext, sources } = await retrieveRelevantContext(initial_message_content, 10, true);

      // Format sources for the system message
      const sourcesText = sources.map(s => 
        `- Source: ${s.source}, Page: ${s.page}, Chapter: ${s.chapter || 'N/A'}`
      ).join('\n');

      // Construct prompt with RAG context and metadata
      const systemMessage = `You are a medical assistant specialized in ${topic.name}.
                            Provide accurate, helpful information based on medical knowledge.
                            If you're unsure, acknowledge the limitations and suggest consulting a healthcare professional.
                            Here is some relevant medical information that may help with the query:
                            ${ragContext}
                            Sources used (cite these in your response when appropriate):
                            ${sourcesText}
                            Formatting Guidelines
                            Follow these formatting conventions in your responses to ensure optimal UI presentation:
                            Text Structure

                            Use clear headings with ## Heading for main sections and ### Subheading for subsections
                            Bold important terms using **text** for key information, conditions, or critical points
                            Italicize emphasis using *text* for mild emphasis or when introducing concepts
                            Use > Blockquote format for important warnings, disclaimers, or key takeaways

                            Lists and Organization

                            Use numbered lists (1. Item) for sequential steps, procedures, or prioritized information
                            Use bullet points (- Item) for general lists, symptoms, or options
                            Indent sub-items using spaces for hierarchical information:
                            Main point
                            Sub-point
                            Another sub-point
                            Always structure your response with clear headings and use appropriate formatting to make the information easy to read and visually organized.`;

      const messages = [
        {
          role: 'system',
          content: systemMessage
        },
        { role: 'user', content: initial_message_content }
      ];

      // Call OpenRouter API
      const assistantResponse = await callOpenRouter(model.openrouter_id, messages);

      // Store the assistant's response with sources and metadata
      try {
        const sourcesJson = JSON.stringify(sources);
        db.prepare(
          'INSERT INTO chat_messages (session_id, role, content, sources) VALUES (?, ?, ?, ?)'
        ).run(session_id, 'assistant', assistantResponse, sourcesJson);
      } catch (error) {
        // Fallback to save without sources if there's an error
        db.prepare(
          'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
        ).run(session_id, 'assistant', assistantResponse);
      }

      // Update the session with the latest message timestamp
      db.prepare(
        'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(session_id);

      // Generate a summary from the initial message
      let title; // Declare title with let to allow reassignment
      try {
        const summary = await summarizeText(initial_message_content);
        // Update the session with the generated summary
        db.prepare(
          'UPDATE chat_sessions SET title = ? WHERE id = ?'
        ).run(summary, session_id);
        // Update the title to be used in the response
        title = summary;
      } catch (summaryErr) {
        // Fallback to first few words of the message if summary fails
        const fallbackTitle = initial_message_content.split(' ').slice(0, 5).join(' ');
        db.prepare(
          'UPDATE chat_sessions SET title = ? WHERE id = ?'
        ).run(fallbackTitle, session_id);
        title = fallbackTitle;
      }

      // Get all messages for the session
      messages_db = db.prepare(
        'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC'
      ).all(session_id);
    }

    res.json({
      session_id,
      title,
      model: model.display_name,
      topic: topic.name,
      messages: messages_db
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message to an existing chat session
router.post('/:sessionId/message', async (req, res) => {
  const { content, model_id, topic_id } = req.body; // model_id and topic_id are now dynamic
  const session_id = req.params.sessionId;
  const user_id = req.user.id;

  if (!content || !model_id || !topic_id) {
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
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(model_id);
    const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(topic_id);

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Store the user message
    db.prepare(
      'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
    ).run(session_id, 'user', content);

    // Check if summary needs to be generated (i.e., title is placeholder)
    let currentTitle = session.title;
    const isPlaceholderTitle = session.title === 'New Session' || session.title === 'New Chat';

    if (isPlaceholderTitle) {
      try {
        // Generate the summary using the summarizeText function
        const summarizedTitle = await summarizeText(content);
        // Clean up the title (remove any extra whitespace, newlines, etc.)
        currentTitle = summarizedTitle
          .replace(/[\n\r]+/g, ' ')  // Replace newlines with spaces
          .trim()                     // Remove leading/trailing spaces
          .replace(/\s+/g, ' ');      // Replace multiple spaces with single space

        // Ensure title is not too long (max 50 chars)
        if (currentTitle.length > 50) {
          currentTitle = currentTitle.substring(0, 47) + '...';
        }

        // Update the session title in the database
        const updateStmt = db.prepare('UPDATE chat_sessions SET title = ? WHERE id = ?');
        const updateResult = updateStmt.run(currentTitle, session_id);

        if (updateResult.changes > 0) {
          session.title = currentTitle; // Update session object in memory
        }
      } catch (summaryErr) {
        // Fallback to a default title based on the first few words
        const fallbackTitle = content.split(' ').slice(0, 5).join(' ');
        currentTitle = fallbackTitle.length > 0 ? fallbackTitle : 'New Chat';

        // Still try to update the database with the fallback title
        try {
          db.prepare('UPDATE chat_sessions SET title = ? WHERE id = ?').run(currentTitle, session_id);
          session.title = currentTitle;
        } catch (dbErr) {
          // Continue even if timestamp update fails
        }
      }
    }

    // Get conversation history (last 10 messages)
    const history = db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp DESC LIMIT 10'
    ).all(session_id);

    // Reverse to get chronological order
    history.reverse();

    // Retrieve relevant context using RAG with metadata and adjacent chunks
    const { context: ragContext, sources } = await retrieveRelevantContext(content, 10, true);

    // Format sources for display in the UI
    const formattedSources = sources.map(source => ({
      page: source.page,
      chapter: source.chapter,
      relevance: source.score,
      preview: source.text.substring(0, 150) + (source.text.length > 150 ? '...' : ''),
      text: source.text  // Keep the full text field!
    }));

    // Construct messages array with system message, conversation history, and new message
    const messages = [
      {
        role: 'system',
        content: `You are a medical assistant specialized in ${topic.name}.
Provide accurate, helpful information based on medical knowledge.
If you're unsure, acknowledge the limitations and suggest consulting a healthcare professional.
Here is some relevant medical information that may help with the query:
${ragContext}
Formatting Guidelines
Follow these formatting conventions in your responses to ensure optimal UI presentation:
Text Structure

Use clear headings with ## Heading for main sections and ### Subheading for subsections
Bold important terms using **text** for key information, conditions, or critical points
Italicize emphasis using *text* for mild emphasis or when introducing concepts
Use > Blockquote format for important warnings, disclaimers, or key takeaways

Lists and Organization

Use numbered lists (1. Item) for sequential steps, procedures, or prioritized information
Use bullet points (- Item) for general lists, symptoms, or options
Indent sub-items using spaces for hierarchical information:
Main point
  Sub-point
  Another sub-point
Always structure your response with clear headings and use appropriate formatting to make the information easy to read and visually organized.`
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

    try {
      // Store the assistant's response with sources
      const insertStmt = db.prepare(
        'INSERT INTO chat_messages (session_id, role, content, sources) VALUES (?, ?, ?, ?)'
      );
      insertStmt.run(
        session_id, 
        'assistant', 
        assistantResponse, 
        JSON.stringify(sources)
      );

      // Update the session with the latest message timestamp
      try {
        const updateStmt = db.prepare(
          'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        );
        updateStmt.run(session_id);
      } catch (updateError) {
        // Continue even if timestamp update fails
      }
    } catch (dbError) {
      // Try to get table info for debugging
      try {
        const tableInfo = db.prepare("PRAGMA table_info(chat_messages)").all();
      } catch (pragmaError) {
        // Continue even if table info fails
      }

      throw dbError; // Re-throw to be caught by the outer catch
    }

    // Get updated messages
    const updated_messages = db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(session_id);

    // Prepare the response with sources and metadata
    const response = {
      session_id,
      title: currentTitle, // Use the potentially updated title
      model: model.display_name,
      topic: topic.name,
      messages: updated_messages.map(msg => {
        // Parse sources if they exist
        const msgSources = msg.sources ? (typeof msg.sources === 'string' ? JSON.parse(msg.sources) : msg.sources) : [];

        // Format sources for the UI
        const formattedSources = msgSources.map(source => ({
          source: source.source || 'Unknown',
          page: source.page || 'N/A',
          chapter: source.chapter || 'N/A',
          relevance: source.score || 'N/A',
          preview: source.text ? (source.text.substring(0, 150) + (source.text.length > 150 ? '...' : '')) : '',
          text: source.text || '' // Keep the full text field!
        }));

        return {
          ...msg,
          // Only include sources for assistant messages
          sources: msg.role === 'assistant' ? formattedSources : []
        };
      })
    };

    res.json(response);
  } catch (err) {
    // Provide more detailed error information in development
    const errorResponse = {
      error: 'Server error',
      ...(process.env.NODE_ENV !== 'production' && {
        details: {
          message: err.message,
          code: err.code,
          stack: err.stack,
          ...(err.response?.data && { responseData: err.response.data })
        }
      })
    };

    res.status(500).json(errorResponse);
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

    // Get all messages for the session with proper source parsing
    const messages = db.prepare(
      `SELECT 
        id,
        session_id,
        role,
        content,
        sources,
        strftime('%Y-%m-%dT%H:%M:%SZ', timestamp) as timestamp
      FROM chat_messages 
      WHERE session_id = ? 
      ORDER BY timestamp ASC`
    ).all(session_id).map(msg => ({
      ...msg,
      sources: msg.sources ? JSON.parse(msg.sources) : []
    }));

    res.json(messages);
  } catch (err) {
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
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
