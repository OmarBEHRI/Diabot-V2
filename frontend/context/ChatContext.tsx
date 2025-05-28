"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { chatAPI, modelsAPI, topicsAPI } from "../lib/api"
import { useAuth } from "./AuthContext" // Import useAuth

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface ChatSession {
  id: number
  title: string
  messages: Message[]
  model_id: number
  topic_id: number
  created_at: string
}

interface Model {
  id: number
  openrouter_id: string
  display_name: string
  accuracy_no_rag: number
  accuracy_rag: number
  description: string
}

interface Topic {
  id: number
  name: string
  rag_filter_keywords: string
}

interface ChatContextType {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  messages: Message[]
  models: Model[]
  topics: Topic[]
  selectedModel: Model | null
  selectedTopic: Topic | null
  isLoading: boolean
  isLoadingModels: boolean
  isLoadingTopics: boolean
  createNewSession: (initialMessage?: string) => Promise<void> // Make initialMessage optional
  selectSession: (sessionId: number) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  setSelectedModel: (model: Model) => void
  setSelectedTopic: (topic: Topic) => void
  loadSessions: () => Promise<void>
  loadModels: () => Promise<void>
  loadTopics: () => Promise<void>
  startNewChat: () => void // Add startNewChat to context type
  deleteSession: (sessionId: number) => Promise<void> // Add deleteSession to context type
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth() // Get user and auth loading state
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [isLoadingTopics, setIsLoadingTopics] = useState(false)

  // Function to start a new chat
  const startNewChat = () => {
    setCurrentSession(null)
    setMessages([])
    // Keep selectedModel and selectedTopic as they are, user wants defaults
  }

  // Load models from API
  const loadModels = async () => {
    setIsLoadingModels(true)
    try {
      const modelsData = await modelsAPI.getModels()
      setModels(modelsData)
    } catch (error) {
      console.error("Error loading models:", error)
      // Do not re-throw, allow other loads to proceed
    } finally {
      setIsLoadingModels(false)
    }
  }

  // Load topics from API
  const loadTopics = async () => {
    setIsLoadingTopics(true)
    try {
      const topicsData = await topicsAPI.getTopics()
      setTopics(topicsData)
    } catch (error) {
      console.error("Error loading topics:", error)
      // Do not re-throw, allow other loads to proceed
    } finally {
      setIsLoadingTopics(false)
    }
  }

  // Load chat sessions from API
  const loadSessions = async () => {
    try {
      const sessionsData = await chatAPI.getSessions()
      setSessions(sessionsData)
    } catch (error) {
      console.error("Error loading sessions:", error)
      // Do not re-throw, allow other loads to proceed
    }
  }

  // Load initial data only if user is authenticated and auth is not loading
  useEffect(() => {
    if (user && !isAuthLoading) {
      loadModels()
      loadTopics()
      loadSessions()
    } else if (!user && !isAuthLoading) {
      // If not authenticated and auth is done loading, clear chat data
      setSessions([])
      setCurrentSession(null)
      setMessages([])
      setModels([])
      setTopics([])
      setSelectedModel(null)
      setSelectedTopic(null)
    }
  }, [user, isAuthLoading]) // Depend on user and isAuthLoading

  // Set default model and topic if not already set after loading
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0]);
    }
    if (topics.length > 0 && !selectedTopic) {
      setSelectedTopic(topics[0]);
    }
  }, [models, topics, selectedModel, selectedTopic]); // Depend on models, topics, and selected states

  const createNewSession = async (initialMessage?: string) => { // Make initialMessage optional
    console.log('🔄 Starting createNewSession with initialMessage:', initialMessage ? `"${initialMessage.substring(0, 30)}${initialMessage.length > 30 ? '...' : ''}"` : 'undefined');
    
    if (!selectedModel || !selectedTopic) {
      console.error("❌ Cannot create session: Model or Topic not selected.");
      return;
    }
    
    console.log(`📋 Using model: ${selectedModel.display_name}, topic: ${selectedTopic.name}`);
    setIsLoading(true)
    
    try {
      console.log('🌐 Calling API to create new session...');
      const response = await chatAPI.createSession(
        selectedModel.id,
        selectedTopic.id,
        initialMessage || "" // Pass empty string if initialMessage is undefined
      )
      
      console.log('✅ Session created successfully with response:', response);
      console.log(`📝 Generated title: "${response.title}"`);
      
      // Convert backend messages to frontend format
      const convertedMessages = response.messages.map((msg: any) => ({
        id: msg.id.toString(),
        content: msg.content,
        role: msg.role as "user" | "assistant",
        timestamp: new Date(msg.timestamp)
      }))
      
      console.log(`📨 Converted ${convertedMessages.length} messages from the response`);

      const newSession: ChatSession = {
        id: response.session_id, // Use session_id from response
        title: response.title, // Use title from response
        messages: convertedMessages,
        model_id: selectedModel.id, // Use selectedModel.id
        topic_id: selectedTopic.id, // Use selectedTopic.id
        created_at: new Date().toISOString() // Use current time for created_at
      }

      console.log('📊 Created new session object:', newSession);
      setSessions(prev => [newSession, ...prev])
      setCurrentSession(newSession)
      setMessages(convertedMessages)
      console.log('✅ State updated with new session');
    } catch (error) {
      console.error("❌ Error creating session:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const selectSession = async (sessionId: number) => {
    try {
      const session = sessions.find(s => s.id === sessionId)
      if (session) {
        setCurrentSession(session)
        // Load messages for this session
        const messagesData = await chatAPI.getMessages(sessionId)
        const convertedMessages = messagesData.map((msg: any) => ({
          id: msg.id.toString(),
          content: msg.content,
          role: msg.role as "user" | "assistant",
          timestamp: new Date(msg.timestamp)
        }))
        setMessages(convertedMessages)
      }
    } catch (error) {
      console.error("Error selecting session:", error)
    }
  }

  const sendMessage = async (content: string) => {
    if (!currentSession) {
      console.error("Cannot send message: No active session");
      return;
    }

    // Add user message immediately to UI
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      content,
      role: "user",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    setIsLoading(true);
    try {
      console.log(`Sending message to session ${currentSession.id} with model_id: ${currentSession.model_id}, topic_id: ${currentSession.topic_id}`);
      const response = await chatAPI.sendMessage(
        currentSession.id, 
        content,
        currentSession.model_id,
        currentSession.topic_id
      );
      
      // Convert backend messages to frontend format
      const convertedMessages = response.messages.map((msg: any) => ({
        id: msg.id.toString(),
        content: msg.content,
        role: msg.role as "user" | "assistant",
        timestamp: new Date(msg.timestamp)
      }));

      console.log(`Received ${convertedMessages.length} messages in response`);
      setMessages(convertedMessages);
      
      // Update the session title if it was a placeholder
      if (response.title && response.title !== currentSession.title) {
        console.log(`Updating session title to: ${response.title}`);
        setCurrentSession(prev => prev ? { ...prev, title: response.title } : null);
        setSessions(prev => 
          prev.map(s => 
            s.id === currentSession.id 
              ? { ...s, title: response.title } 
              : s
          )
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove the temporary user message on error
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  const deleteSession = async (sessionId: number) => {
    try {
      await chatAPI.deleteSession(sessionId);
      setSessions(prevSessions => prevSessions.filter(session => session.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      throw error;
    }
  };

  return (
    <ChatContext.Provider
      value={{
        sessions,
        currentSession,
        messages,
        models,
        topics,
        selectedModel,
        selectedTopic,
        isLoading,
        isLoadingModels,
        isLoadingTopics,
        createNewSession,
        selectSession,
        sendMessage,
        setSelectedModel,
        setSelectedTopic,
        loadSessions,
        loadModels,
        loadTopics,
        startNewChat, // Include startNewChat in the context value
        deleteSession, // Include deleteSession in the context value
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
}
