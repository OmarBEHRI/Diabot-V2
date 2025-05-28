"use client"

import { format } from "date-fns"
import { User, Bot } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface MessageProps {
  message: {
    id: string
    content: string
    role: "user" | "assistant"
    timestamp: Date
  }
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === "user"

  return (
    <div className={`flex items-start space-x-3 ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}>
      <Avatar className={`${isUser ? "bg-blue-500" : "bg-green-500"}`}>
        <AvatarFallback className="text-white">
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={`flex-1 max-w-3xl ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block p-4 rounded-lg ${
            isUser ? "bg-blue-500 text-white" : "bg-white border border-gray-200 text-gray-900"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        <p className={`text-xs text-gray-500 mt-1 ${isUser ? "text-right" : ""}`}>
          {format(message.timestamp, "HH:mm")}
        </p>
      </div>
    </div>
  )
}
