/**
 * API Client Module
 * 
 * Centralizes all API communication with the backend server, providing:
 * - Authentication services (login, register, token management)
 * - Chat services (sessions, messages, sources)
 * - Model and topic management
 * - Knowledge base operations
 * - Error handling and authentication state management
 */

import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    return response.data;
  },

  register: async (username: string, password: string) => {
    const response = await api.post('/api/auth/register', { username, password });
    return response.data;
  },
};

// Models API calls
export const modelsAPI = {
  getModels: async () => {
    const response = await api.get('/api/models');
    return response.data;
  },
};

// Topics API calls
export const topicsAPI = {
  getTopics: async () => {
    const response = await api.get('/api/topics');
    return response.data;
  },
};

// Chat API calls
export const chatAPI = {
  createSession: async (modelId: number, topicId: number, initialMessage: string) => {
    // console.log removed ('💬 Frontend: Creating new chat session with params:', { modelId, topicId, initialMessageLength: initialMessage?.length || 0 });
    try {
      const response = await api.post('/api/chat/new_session', {
        model_id: modelId,
        topic_id: topicId,
        initial_message: initialMessage
      });
      
      const data = response.data;
      
      // Ensure messages have the correct format with sources
      if (data.messages && Array.isArray(data.messages)) {
        data.messages = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          sources: msg.sources || []
        }));
      }
      
      return data;
    } catch (error) {
      // console.error removed ('❌ Frontend: Error creating chat session:', error);
      throw error;
    }
  },

  sendMessage: async (sessionId: number, content: string, modelId?: number, topicId?: number) => {
    if (modelId === undefined || topicId === undefined) {
      throw new Error('modelId and topicId are required for sending messages');
    }
    
    const response = await api.post(`/api/chat/${sessionId}/message`, { 
      content,
      model_id: modelId,
      topic_id: topicId
    });
    
    // Transform the response to match our frontend format
    const data = response.data;
    
    // If the response includes messages, make sure they have the correct format
    if (data.messages && Array.isArray(data.messages)) {
      data.messages = data.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
        sources: msg.sources || []
      }));
    }
    
    // If the response is just a single message (legacy format), wrap it in a messages array
    if (data.content && !data.messages) {
      data.messages = [{
        id: `msg-${Date.now()}`,
        content: data.content,
        role: 'assistant',
        timestamp: new Date(),
        sources: data.sources || []
      }];
    }
    
    return data;
  },

  getSessions: async () => {
    const response = await api.get('/api/chat/sessions');
    return response.data;
  },

  getMessages: async (sessionId: number) => {
    const response = await api.get(`/api/chat/${sessionId}/messages`);
    
    // Ensure messages have the correct format with sources
    if (Array.isArray(response.data)) {
      return response.data.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
        sources: msg.sources || []
      }));
    }
    
    return [];
  },
  deleteSession: async (sessionId: number) => {
    await api.delete(`/api/chat/sessions/${sessionId}`);
  },
  
  deleteAllChatHistory: async () => {
    try {
      const response = await api.delete('/api/settings/chat-history');
      return response.data;
    } catch (error) {
      // console.error removed ('Error deleting all chat history:', error);
      throw error;
    }
  },
  
  // Fetch the full text content of a source document
  getSourceFullText: async (source: string, page: string | number) => {
    try {
      const response = await api.get('/api/sources/full_text', {
        params: { source, page }
      });
      return response.data;
    } catch (error) {
      // console.error removed ('Error fetching full text content:', error);
      return null;
    }
  },
};

export default api;
