"use client"

import type React from "react"

import { useState } from "react"
import { useChat } from "@/context/ChatContext"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2 } from "lucide-react"

export default function MessageInput() {
  const { sendMessage, isLoading, currentSession, createNewSession } = useChat() // Import createNewSession
  const [input, setInput] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return // Removed !currentSession check here

    const message = input.trim()
    setInput("")

    if (!currentSession) {
      // If no current session, create a new one with this message
      await createNewSession(message)
    } else {
      // Otherwise, send message to existing session
      await sendMessage(message)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="p-6 w-full">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="flex items-end space-x-4">
          <div className="flex-1">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a medical question..."
              className="min-h-[60px] max-h-32 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="medical-gradient h-[60px] px-6"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        <p className="text-xs text-gray-500 mt-2 text-center">Press Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  )
}
