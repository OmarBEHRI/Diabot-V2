"use client"

/**
 * ChatContext
 * 
 * Provides global state management for chat functionality throughout the application.
 * Handles chat sessions, messages, models, topics, and all related operations including:
 * - Session creation and management
 * - Message sending and receiving
 * - Model and topic selection
 * - RAG context integration
 */

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { chatAPI, modelsAPI, topicsAPI } from "../lib/api"
import { useAuth } from "./AuthContext"
import { getModelAccuracy, shouldExcludeModel } from "../lib/modelAccuracyUtils"

interface SourceDocument {
  text: string
  source: string
  page: string | number
  score?: string | number
  chapter?: string;
}

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  sources?: SourceDocument[]
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
  isDeletingAllHistory: boolean
  createNewSession: (initialMessage?: string) => Promise<ChatSession | undefined> // Return the created session
  selectSession: (sessionId: number) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  setSelectedModel: (model: Model) => void
  setSelectedTopic: (topic: Topic) => void
  loadSessions: () => Promise<void>
  loadModels: () => Promise<void>
  loadTopics: () => Promise<void>
  startNewChat: () => void // Add startNewChat to context type
  deleteSession: (sessionId: number) => Promise<void> // Add deleteSession to context type
  deleteAllChatHistory: () => Promise<void> // Add deleteAllChatHistory to context type
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
  const [isDeletingAllHistory, setIsDeletingAllHistory] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [needsInitialSession, setNeedsInitialSession] = useState(true)

  const startNewChat = () => {
    setCurrentSession(null)
    setMessages([])
  }

  const loadModels = async () => {
    setIsLoadingModels(true)
    try {
      const modelsData = await modelsAPI.getModels()
      
      const filteredModels = modelsData
        .filter((model: Model) => !shouldExcludeModel(model.openrouter_id, model.id))
        .map((model: Model) => ({
          ...model,
          accuracy_rag: getModelAccuracy(model.openrouter_id)
        }))
      
      setModels(filteredModels)
      
      if (!selectedModel && filteredModels.length > 0) {
        setSelectedModel(filteredModels[0])
      }
    } catch (error) {
      // Error handling silently fails to allow other loads to proceed
    } finally {
      setIsLoadingModels(false)
    }
  }

  const loadTopics = async () => {
    setIsLoadingTopics(true)
    try {
      const topicsData = await topicsAPI.getTopics()
      setTopics(topicsData)
    } catch (error) {
      // Error handling silently fails to allow other loads to proceed
    } finally {
      setIsLoadingTopics(false)
    }
  }

  const loadSessions = async () => {
    try {
      const sessionsData = await chatAPI.getSessions()
      setSessions(sessionsData)
    } catch (error) {
      // Error handling silently fails to allow other loads to proceed
    }
  }

  useEffect(() => {
    if (user && !isAuthLoading) {
      loadModels()
      loadTopics()
      loadSessions()
      setNeedsInitialSession(true)
    } else if (!user && !isAuthLoading) {
      setSessions([])
      setCurrentSession(null)
      setMessages([])
      setModels([])
      setTopics([])
      setSelectedModel(null)
      setSelectedTopic(null)
      setNeedsInitialSession(true)
    }
  }, [user, isAuthLoading])

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      const llama31Model = models.find(m => 
        m.display_name.includes("Llama 3.1 8B") || 
        m.openrouter_id === "meta-llama/llama-3.1-8b-instruct"
      );
      
      if (llama31Model) {
        setSelectedModel(llama31Model);
      } else {
        const defaultModel = models.find(m => 
          !m.display_name.toLowerCase().includes("mistral 7b") && 
          !m.display_name.toLowerCase().includes("claude instant")
        ) || models[0];
        
        setSelectedModel(defaultModel);
      }
    }
    
    if (topics.length > 0 && !selectedTopic) {
      setSelectedTopic(topics[0]);
    }
  }, [models, topics, selectedModel, selectedTopic]);

  const createNewSession = async (initialMessage?: string) => {
    if (!selectedModel || !selectedTopic) {
      return;
    }
    
    const existingTempUserMessage = messages.find(msg => msg.role === 'user' && msg.id.startsWith('temp-'));
    
    if (!isLoading) {
      setIsLoading(true);
    }
    
    try {
      const response = await chatAPI.createSession(
        selectedModel.id,
        selectedTopic.id,
        initialMessage || ""
      )
      
      const convertedMessages = response.messages.map((msg: any) => ({
        id: msg.id.toString(),
        content: msg.content,
        role: msg.role as "user" | "assistant",
        timestamp: new Date(msg.timestamp),
        sources: msg.sources ? msg.sources.map((s: any) => ({
          text: s.text,
          source: s.source,
          page: s.page,
          chapter: s.chapter,
          score: typeof s.score === 'string' ? parseFloat(s.score) : s.score
        })) : undefined
      }))

      const newSession: ChatSession = {
        id: response.session_id,
        title: response.title,
        messages: convertedMessages,
        model_id: selectedModel.id,
        topic_id: selectedTopic.id,
        created_at: new Date().toISOString()
      }

      setSessions(prev => [newSession, ...prev])
      setCurrentSession(newSession)
      setMessages(convertedMessages)
      
      return newSession;
    } catch (error) {
      // console.error removed ("❌ Error creating session:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Automatically create a new session when the component mounts if there isn't one already
  useEffect(() => {
    const initializeSession = async () => {
      if (!isLoadingModels && !isLoadingTopics && selectedModel && selectedTopic &&
          !currentSession && !isInitializing && needsInitialSession) {
        setIsInitializing(true);
        setNeedsInitialSession(false);
        try {
          if (sessions.length > 0) {
            // Sort sessions by created_at descending (assuming ISO string)
            const sortedSessions = [...sessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const lastSession = sortedSessions[0];
            if (lastSession && (!lastSession.messages || lastSession.messages.length === 0)) {
              // If the last session is empty, just set it as current
              setCurrentSession(lastSession);
              setMessages([]);
              // console.log removed ('Set last empty session as current session.');
              return;
            }
          }
          // Otherwise, create a new session
          // console.log removed ('Automatically creating a new session on chat page load');
          await createNewSession();
        } catch (error) {
          // console.error removed ('Error creating initial session:', error);
          setNeedsInitialSession(true);
        } finally {
          setIsInitializing(false);
        }
      }
    };
    initializeSession();
  }, [isLoadingModels, isLoadingTopics, selectedModel, selectedTopic, currentSession, createNewSession, isInitializing, needsInitialSession, sessions])

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
          timestamp: new Date(msg.timestamp),
          sources: msg.sources ? msg.sources.map((s: any) => ({ text: s.text, source: s.source, page: s.page, chapter: s.chapter, score: typeof s.score === 'string' ? parseFloat(s.score) : s.score })) : undefined
        }))
        setMessages(convertedMessages)
      }
    } catch (error) {
      // console.error removed ("Error selecting session:", error)
    }
  }

  const sendMessage = async (content: string) => {
    // Set loading state immediately
    setIsLoading(true);
    let userMessage: Message | null = null;

    try {
      // Add user message to UI immediately, regardless of whether we have a session
      userMessage = {
        id: `temp-${Date.now()}`,
        content,
        role: "user" as const,
        timestamp: new Date(),
        sources: []
      };
      setMessages(prev => [...prev, userMessage].filter(Boolean) as Message[]);
      
      // If no active session, create a new one first
      if (!currentSession) {
        // console.log removed ("No active session, creating a new one before sending message");
        try {
          const newSession = await createNewSession(content);
          if (newSession) {
            // The session has been created with the initial message
            // We've already updated the UI in createNewSession, so we can return here
            return;
          }
          // If createNewSession didn't return a session (unlikely), continue with normal flow
        } catch (error) {
          // console.error removed ("Error creating session:", error);
          // Remove the temporary user message on error
          if (userMessage) {
            setMessages(prev => prev.filter(msg => msg.id !== userMessage!.id));
          }
          throw error;
        }
      }

      // Make sure currentSession is not null before using it
      if (!currentSession) {
        throw new Error("Current session is null, cannot send message");
      }
      
      // console.log removed (`Sending message to session ${currentSession.id} with model_id: ${currentSession.model_id}, topic_id: ${currentSession.topic_id}`);
      const response = await chatAPI.sendMessage(
        currentSession.id, 
        content,
        currentSession.model_id,
        currentSession.topic_id
      );
      
      // console.log removed ('API Response:', response); // Debug log
      
      // Convert backend messages to frontend format
      const convertedMessages = response.messages.map((msg: any) => {
        // Find the assistant's response in the messages
        const isAssistantResponse = msg.role === 'assistant' && 
                                 msg.id === response.messages[response.messages.length - 1]?.id;
        
        // Ensure sources are properly formatted and processed
        let processedSources = undefined;
        
        if (isAssistantResponse && msg.sources) {
          // Make sure sources are in the correct format
          processedSources = Array.isArray(msg.sources) ? msg.sources : [msg.sources];
          
          // console.log removed ('Raw sources from API:', JSON.stringify(processedSources, null, 2));
          
          // Log each source's preview and text fields to diagnose the issue
          processedSources.forEach((source: any, index: number) => {
            // console.log removed (`Source ${index} - preview:`, source.preview?.substring(0, 50) + '...');
            // console.log removed (`Source ${index} - text:`, source.text?.substring(0, 50) + '...');
            // console.log removed (`Source ${index} - full_text:`, source.full_text?.substring(0, 50) + '...');
          });
          
          // Ensure each source has the required properties
          processedSources = processedSources.map((source: any) => {
            // Check for different possible field names for the full text content
            const fullText = source.full_text || source.fullText || source.full_content || source.content;
            
            return {
              ...source,
              // Map relevance to score if it exists, otherwise use existing score or default to 0
              score: source.relevance !== undefined ? source.relevance : 
                    source.score !== undefined ? source.score : 0,
              // Use preview for the preview field if it exists
              preview: source.preview || source.text?.substring(0, 150) || 'No preview available',
              // Use full_text for the text field if it exists, otherwise use text or preview
              text: fullText || source.text || source.preview || 'No content available'
            };
          });
          
          // Log processed sources after transformation
          // console.log removed ('Processed sources after transformation:');
          processedSources.forEach((source: any, index: number) => {
            // console.log removed (`Processed source ${index} - preview:`, source.preview?.substring(0, 50) + '...');
            // console.log removed (`Processed source ${index} - text:`, source.text?.substring(0, 50) + '...');
          });
        }
        
        return {
          id: msg.id.toString(),
          content: msg.content,
          role: msg.role as "user" | "assistant",
          timestamp: new Date(msg.timestamp),
          // Use the properly processed sources
          sources: processedSources
        };
      });

      // Processed message sources information removed
      
      // Update messages with a new array reference to ensure React detects the change
      setMessages([...convertedMessages]);
      
      // Force a re-render after a short delay to ensure UI updates
      setTimeout(() => {
        setMessages(prev => [...prev]);
      }, 100);
      
      // Update the session title if it was a placeholder
      if (response.title && currentSession && response.title !== currentSession.title) {
        // console.log removed (`Updating session title to: ${response.title}`);
        setCurrentSession(prev => prev ? { ...prev, title: response.title } : null);
        setSessions(prev => 
          prev.map(s => 
            currentSession && s.id === currentSession.id 
              ? { ...s, title: response.title } 
              : s
          )
        );
      }
    } catch (error) {
      // console.error removed ("Error sending message:", error);
      // Remove the temporary user message on error
      if (userMessage) {
        setMessages(prev => prev.filter(msg => msg.id !== userMessage!.id));
      }
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
      // console.error removed ("Error deleting session:", error);
      throw error;
    }
  };

  const deleteAllChatHistory = async () => {
    setIsDeletingAllHistory(true);
    try {
      await chatAPI.deleteAllChatHistory();
      // Clear all sessions and current session
      setSessions([]);
      setCurrentSession(null);
      setMessages([]);
      // Reset needsInitialSession to create a new empty session
      setNeedsInitialSession(true);
      return;
    } catch (error) {
      // console.error removed ("Error deleting all chat history:", error);
      throw error;
    } finally {
      setIsDeletingAllHistory(false);
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
        isDeletingAllHistory,
        createNewSession,
        selectSession,
        sendMessage,
        setSelectedModel,
        setSelectedTopic,
        loadSessions,
        loadModels,
        loadTopics,
        startNewChat,
        deleteSession,
        deleteAllChatHistory
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
