"use client"

/**
 * Chat Window Component
 * 
 * Displays the chat conversation between the user and the AI assistant.
 * Features include:
 * - Message grouping by date
 * - Automatic scrolling to the latest message
 * - Loading states and empty state handling
 * - Integration with the Diabot logo for branding
 */

import { useChat } from "@/context/ChatContext"
import { useEffect, useRef, useMemo } from "react"
import Message, { type MessageProps } from "./Message"
import { Loader2, Bot } from "lucide-react"

export default function ChatWindow() {
  const { currentSession, messages, isLoading } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: MessageProps["message"][] }[] = []
    let currentDate = ""
    let currentGroup: MessageProps["message"][] = []

    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      }).format(new Date(date))
    }

    messages.forEach((message) => {
      const messageDate = formatDate(message.timestamp)
      
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({
            date: currentDate,
            messages: [...currentGroup]
          })
          currentGroup = []
        }
        currentDate = messageDate
      }
      
      currentGroup.push(message)
    })

    // Add the last group
    if (currentGroup.length > 0) {
      groups.push({
        date: currentDate,
        messages: currentGroup
      })
    }

    return groups
  }, [messages])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  if (!currentSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Bot className="h-12 w-12 mb-4 text-gray-300" />
        <p className="text-lg font-medium">Start a new chat to begin</p>
        <p className="text-sm text-center max-w-md mt-2">
          Ask questions about diabetes management, nutrition, or any health-related topics.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-200"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        {groupedMessages.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-6">
            <div className="sticky top-2 z-10">
              <div className="mx-auto w-fit bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400 shadow-sm border border-gray-200 dark:border-gray-700">
                {group.date}
              </div>
            </div>
            <div className="space-y-6">
              {group.messages.map((message) => (
                <Message
                  key={message.id}
                  message={{
                    ...message,
                    timestamp: new Date(message.timestamp)
                  }}
                  className="group"
                />
              ))}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm text-gray-600 dark:text-gray-300">AI is thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
