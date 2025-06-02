import fetch from 'node-fetch';
import { LocalEmbedder } from './localEmbeddings.js';

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const EMBEDDING_MODEL = 'BAAI/bge-large-en-v1.5'; // Using the same model as in process_textbook.py
const EMBEDDING_DIMENSION = 1024; // Dimension for BAAI/bge-large-en-v1.5

if (!OPENROUTER_API_KEY) {
  console.warn('OpenRouter API key not found. Some features may be limited.');
}

// Check if API key is set and log status
const isApiKeySet = OPENROUTER_API_KEY && OPENROUTER_API_KEY.length > 10;
console.log("OpenRouter API Key status:", isApiKeySet ? "Set (first 5 chars: " + OPENROUTER_API_KEY.substring(0, 5) + ")" : "Not set - using mock responses");

// Constants for API requests
const YOUR_SITE_URL = 'http://localhost:3000';
const YOUR_SITE_NAME = 'Diabot Medical Assistant';

// List of reliable fallback models in order of preference
const FALLBACK_MODELS = [
  'openai/gpt-3.5-turbo',
  'meta-llama/llama-3.1-8b-instruct',
  'google/gemini-1.5-pro'
];

async function callOpenRouter(model, messages, temperature = 0.7, maxTokens = 2000) {
  // Check if model is one of the problematic ones and replace with a fallback
  if (model.includes('claude-instant') || model.includes('mistral-7b-instruct')) {
    const fallbackModel = FALLBACK_MODELS[0];
    console.log(`⚠️ Replacing problematic model ${model} with fallback model ${fallbackModel}`);
    model = fallbackModel;
  }
  try {
    // If API key is not set, use mock response
    if (!isApiKeySet) {
      console.log(`🔄 Using mock response for model: ${model}`);
      return generateMockResponse(messages);
    }

    console.log(`🔄 Calling OpenRouter API with model: ${model}...`);
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
      console.error(`❌ API Error for ${model}: ${response.status} ${errorText}`);
      
      // Try fallback models before giving up
      for (const fallbackModel of FALLBACK_MODELS) {
        // Skip if this is the model that just failed
        if (fallbackModel === model) continue;
        
        console.log(`🔄 Trying fallback model: ${fallbackModel}...`);
        try {
          const fallbackResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'HTTP-Referer': YOUR_SITE_URL,
              'X-Title': YOUR_SITE_NAME,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: fallbackModel,
              messages: messages,
              temperature: temperature,
              max_tokens: maxTokens,
            }),
          });
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log(`✅ Received response from fallback model ${fallbackModel}`);
            return fallbackData.choices[0].message.content.trim();
          }
        } catch (fallbackError) {
          console.error(`❌ Error with fallback model ${fallbackModel}:`, fallbackError);
        }
      }
      
      // If all fallbacks fail, use mock response
      console.log(`🔄 All fallback models failed, using mock response`);
      return generateMockResponse(messages);
    }

    const data = await response.json();
    console.log(`✅ Received response from OpenRouter API`);
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error(`❌ Error calling OpenRouter:`, error);
    console.log(`🔄 Falling back to mock response due to error`);
    return generateMockResponse(messages);
  }
}

// Use the same embedding model as used during storage (BAAI/bge-large-en-v1.5)
async function getEmbedding(text, model = EMBEDDING_MODEL) {
  // If API key is not set, use mock embedding
  if (!isApiKeySet) {
    console.log(`🔄 Using mock embedding for text: ${text.substring(0, 30)}...`);
    return generateMockEmbedding(text);
  }

  try {
    console.log(`🔄 Getting embedding for text: ${text.substring(0, 30)}...`);
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
      console.error(`❌ API Error for embeddings: ${response.status} ${errorText}`);
      console.log(`🔄 Falling back to mock embedding`);
      return generateMockEmbedding(text);
    }

    const data = await response.json();
    console.log(`✅ Received embedding from OpenRouter API`);
    return data.data[0].embedding;
  } catch (error) {
    console.error(`❌ Error getting embedding:`, error);
    console.log(`🔄 Falling back to mock embedding due to error`);
    return generateMockEmbedding(text);
  }
}

async function summarizeText(text, model = 'deepseek/deepseek-chat-v3-0324') { // Default to gemma for summarization
  console.log('🔍 Starting summary generation for text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));

  if (!text || text.trim() === '') {
    console.log('⚠️ Empty text provided for summarization, returning default title');
    return 'New Chat';
  }

  const messages = [
    { role: 'system', content: 'You are a helpful assistant. Summarize the following text concisely, in 3 words, suitable for a chat title, and do not include any additional information.' },
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

// Helper function to generate a mock response based on user messages
function generateMockResponse(messages) {
  // Extract the user's message
  const userMessage = messages.find(msg => msg.role === 'user')?.content || '';

  // Generate a simple response based on the user's message
  if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
    return "Hello! I'm your medical assistant. How can I help you today?";
  } else if (userMessage.toLowerCase().includes('diabetes')) {
    return "Diabetes is a chronic condition that affects how your body processes blood sugar. There are two main types: Type 1 and Type 2. It's important to manage blood sugar levels through diet, exercise, and sometimes medication. Regular check-ups with your healthcare provider are essential.";
  } else if (userMessage.toLowerCase().includes('blood pressure') || userMessage.toLowerCase().includes('hypertension')) {
    return "High blood pressure (hypertension) is a common condition where the force of blood against artery walls is too high. It often has no symptoms but can lead to serious health problems. Lifestyle changes like reducing salt intake, regular exercise, and medication can help manage it.";
  } else if (userMessage.toLowerCase().includes('headache') || userMessage.toLowerCase().includes('pain')) {
    return "Headaches can have many causes including stress, dehydration, lack of sleep, or underlying medical conditions. For occasional headaches, rest, hydration, and over-the-counter pain relievers may help. If headaches are severe or persistent, please consult with a healthcare professional.";
  } else {
    return "Thank you for your question. As a medical assistant, I aim to provide helpful information based on medical knowledge. For personalized advice, please consult with a healthcare professional.";
  }
}

// Helper function to generate a mock embedding
function generateMockEmbedding(text) {
  // Create a deterministic but unique embedding based on the text
  // This is a simple hash function to generate a pseudo-random but consistent vector
  const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Generate a 1536-dimensional vector (common for embeddings)
  const embedding = [];
  for (let i = 0; i < 1536; i++) {
    // Generate a value between -1 and 1 based on the seed and position
    const value = Math.sin(seed * (i + 1)) / 2;
    embedding.push(value);
  }

  return embedding;
}

export { callOpenRouter, getEmbedding, summarizeText, isApiKeySet };
