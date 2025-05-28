"use client"

import { useChat } from "@/context/ChatContext"
import { useEffect, useRef } from "react"
// import { ScrollArea } from "@/components/ui/scroll-area" // Removed ScrollArea
import Message from "./Message"
import { Loader2 } from "lucide-react"

export default function ChatWindow() {
  const { currentSession, messages, isLoading } = useChat()
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      // const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]") // Removed specific query
      // if (scrollContainer) {
      //   scrollContainer.scrollTop = scrollContainer.scrollHeight
      // }
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight // Direct scroll
    }
  }, [messages])

  if (!currentSession) {
    return null
  }

  return (
    <div ref={scrollAreaRef} className="h-full overflow-y-auto p-6"> {/* Replaced ScrollArea with div */}
      <div className="max-w-4xl mx-auto space-y-6">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}

        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>AI is thinking...</span>
          </div>
        )}
      </div>
    </div>
  )
}
