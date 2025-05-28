const fetch = require('node-fetch');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
console.log("OpenRouter API Key (first 5 chars):", OPENROUTER_API_KEY ? OPENROUTER_API_KEY.substring(0, 5) : "Not set");
const YOUR_SITE_URL = 'http://localhost:3000';
const YOUR_SITE_NAME = 'Diabot Medical Assistant';

async function callOpenRouter(model, messages, temperature = 0.7, maxTokens = 500) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': YOUR_SITE_URL,
        'X-Title': YOUR_SITE_NAME,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error for ${model}: ${response.status} ${errorText}`);
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error(`Error calling OpenRouter:`, error);
    throw error;
  }
}

async function getEmbedding(text, model = 'openai/text-embedding-ada-002') {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': YOUR_SITE_URL,
        'X-Title': YOUR_SITE_NAME,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error for embeddings: ${response.status} ${errorText}`);
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error(`Error getting embedding:`, error);
    throw error;
  }
}

async function summarizeText(text, model = 'google/gemma-7b-it:free') { // Default to gemma for summarization
  console.log('🔍 Starting summary generation for text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
  
  if (!text || text.trim() === '') {
    console.log('⚠️ Empty text provided for summarization, returning default title');
    return 'New Chat';
  }
  
  const messages = [
    { role: 'system', content: 'You are a helpful assistant. Summarize the following text concisely, in 5-10 words, suitable for a chat title.' },
    { role: 'user', content: text }
  ];
  
  try {
    console.log(`🤖 Calling OpenRouter API with model: ${model} for summarization`);
    const summary = await callOpenRouter(model, messages, 0.5, 50); // Lower temperature, max_tokens for concise summary
    console.log('✅ Successfully generated summary:', summary);
    
    // If summary is empty or too short, fallback to truncated text
    if (!summary || summary.trim().length < 3) {
      console.log('⚠️ Generated summary too short, falling back to truncated text');
      return text.substring(0, 30) + '...';
    }
    
    return summary;
  } catch (error) {
    console.error("❌ Error summarizing text:", error);
    // More robust fallback - extract first few words if possible
    const words = text.split(' ').slice(0, 5).join(' ');
    const fallbackTitle = words + (words.length < text.length ? '...' : '');
    console.log('⚠️ Using fallback title:', fallbackTitle);
    return fallbackTitle;
  }
}

module.exports = {
  callOpenRouter,
  getEmbedding,
  summarizeText
};
