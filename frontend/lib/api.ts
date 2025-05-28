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
    console.log('💬 Frontend: Creating new chat session with params:', { modelId, topicId, initialMessageLength: initialMessage?.length || 0 });
    try {
      const response = await api.post('/api/chat/new_session', {
        model_id: modelId,
        topic_id: topicId,
        initial_message_content: initialMessage,
      });
      console.log('✅ Frontend: Chat session created successfully with title:', response.data.title);
      return response.data;
    } catch (error) {
      console.error('❌ Frontend: Error creating chat session:', error);
      throw error;
    }
  },

  sendMessage: async (sessionId: number, content: string) => {
    const response = await api.post(`/api/chat/${sessionId}/message`, { content });
    return response.data;
  },

  getSessions: async () => {
    const response = await api.get('/api/chat/sessions');
    return response.data;
  },

  getMessages: async (sessionId: number) => {
    const response = await api.get(`/api/chat/${sessionId}/messages`);
    return response.data;
  },
  deleteSession: async (sessionId: number) => {
    await api.delete(`/api/chat/sessions/${sessionId}`);
  },
};

export default api;
