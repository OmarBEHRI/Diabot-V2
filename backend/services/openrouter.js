/**
 * OpenRouter API Service
 * 
 * Provides integration with OpenRouter for AI model access:
 * - Handles API calls to various AI models (GPT, Gemini, Llama, etc.)
 * - Manages text embedding generation for semantic search
 * - Supports text summarization for chat sessions
 * - Includes fallback mechanisms and mock responses when API is unavailable
 * - Handles model-specific configurations and error handling
 */

import fetch from 'node-fetch';
import { LocalEmbedder } from './localEmbeddings.js';

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const EMBEDDING_MODEL = 'BAAI/bge-large-en-v1.5'; // Using the same model as in process_textbook.py
const EMBEDDING_DIMENSION = 1024; // Dimension for BAAI/bge-large-en-v1.5

// Check if API key is set
const isApiKeySet = OPENROUTER_API_KEY && OPENROUTER_API_KEY.length > 10;

// Constants for API requests
const YOUR_SITE_URL = 'http://localhost:3000';
const YOUR_SITE_NAME = 'Diabot Medical Assistant';

// List of reliable fallback models in order of preference
const FALLBACK_MODELS = [
  'openai/gpt-3.5-turbo',
  'meta-llama/llama-3.1-8b-instruct',
  'google/gemini-1.5-pro'
];

/**
 * Calls OpenRouter API for chat completions.
 */
async function callOpenRouter(model, messages, temperature = 0.7, maxTokens = 2000) {
  if (model.includes('claude-instant') || model.includes('mistral-7b-instruct')) {
    const fallbackModel = FALLBACK_MODELS[0];
    model = fallbackModel;
  }
  try {
    if (!isApiKeySet) {
      return generateMockResponse(messages);
    }

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
      
      for (const fallbackModel of FALLBACK_MODELS) {
        if (fallbackModel === model) continue;
        
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
            return fallbackData.choices[0].message.content.trim();
          }
        } catch (fallbackError) {}
      }
      
      return generateMockResponse(messages);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    return generateMockResponse(messages);
  }
}

/**
 * Fetches embeddings for the given text.
 */
async function getEmbedding(text, model = EMBEDDING_MODEL) {
  if (!isApiKeySet) {
    return generateMockEmbedding(text);
  }

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
      return generateMockEmbedding(text);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    return generateMockEmbedding(text);
  }
}

/**
 * Summarizes text into a concise chat title.
 */
async function summarizeText(text, model = 'deepseek/deepseek-chat-v3-0324') {
  if (!text || text.trim() === '') {
    return 'New Chat';
  }

  const messages = [
    { role: 'system', content: 'You are a helpful assistant. Summarize the following text concisely, in 3 words, suitable for a chat title, and do not include any additional information.' },
    { role: 'user', content: text }
  ];

  try {
    const summary = await callOpenRouter(model, messages, 0.5, 50);

    if (!summary || summary.trim().length < 3) {
      return text.substring(0, 30) + '...';
    }

    return summary;
  } catch (error) {
    const words = text.split(' ').slice(0, 5).join(' ');
    const fallbackTitle = words + (words.length < text.length ? '...' : '');
    return fallbackTitle;
  }
}

/**
 * Generates a mock response based on the user's message.
 */
function generateMockResponse(messages) {
  const userMessage = messages.find(msg => msg.role === 'user')?.content || '';

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

/**
 * Generates a mock embedding for the given text.
 */
function generateMockEmbedding(text) {
  const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const embedding = [];
  for (let i = 0; i < 1536; i++) {
    const value = Math.sin(seed * (i + 1)) / 2;
    embedding.push(value);
  }
  return embedding;
}

export { callOpenRouter, getEmbedding, summarizeText, isApiKeySet };
