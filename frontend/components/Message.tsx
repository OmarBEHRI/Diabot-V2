"use client"

import React, { useState, useEffect } from "react"
import { format } from "date-fns"
import { User, Bot, ChevronDown, ChevronUp } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { SourceDocument, SourceDocuments } from "./SourceDocuments"

export interface MessageProps {
  message: {
    id: string
    content: string
    role: "user" | "assistant"
    timestamp: Date
    sources?: SourceDocument[]
  }
  className?: string
}

export default function Message({ message, className }: MessageProps) {
  const isUser = message.role === "user"
  const [showSources, setShowSources] = useState(false)
  const hasSources = message.sources && message.sources.length > 0
  
  // Log message props for debugging
  React.useEffect(() => {
    console.log('💬 Message props:', {
      id: message.id,
      role: message.role,
      hasSources,
      sources: message.sources,
      contentPreview: message.content.substring(0, 50) + '...'
    });
    
    if (hasSources) {
      console.log('📚 Sources in message:', JSON.stringify(message.sources, null, 2));
    }
  }, [message, hasSources]);

  return (
    <div className={cn("group w-full", className)}>
      <div className={cn(
        "flex items-start gap-3 w-full max-w-5xl mx-auto px-4 py-4",
        isUser ? "justify-end" : "justify-start"
      )}>
        {!isUser && (
          <Avatar className="h-8 w-8 bg-green-100">
            <AvatarFallback className="bg-green-100 text-green-600">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}

        <div className={cn("flex-1", isUser ? "flex justify-end" : "")}>
          <div className={cn("flex flex-col w-full max-w-3xl", isUser ? "items-end" : "")}>
            <div
              className={cn(
                "rounded-2xl px-4 py-3 text-sm shadow-sm",
                isUser 
                  ? "bg-blue-500 text-white rounded-br-none" 
                  : "bg-gray-100 text-gray-900 rounded-bl-none"
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {!isUser && hasSources && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowSources(!showSources)}
                    className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showSources ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Hide sources
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Show sources ({message.sources?.length})
                      </>
                    )}
                  </button>
                  {showSources && message.sources && (
                    <div className="mt-2">
                      <SourceDocuments sources={message.sources} />
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className={cn(
              "text-xs mt-1 text-gray-500",
              isUser ? "text-right" : ""
            )}>
              {format(new Date(message.timestamp), "h:mm a")}
            </div>
          </div>
        </div>

        {isUser && (
          <Avatar className="h-8 w-8 bg-blue-100">
            <AvatarFallback className="bg-blue-100 text-blue-600">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}
