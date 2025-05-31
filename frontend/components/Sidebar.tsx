"use client"

import { useChat } from "@/context/ChatContext"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { MessageCircle, Clock, PlusCircle, Trash2, Search } from "lucide-react" // Import Trash2 and Search
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/components/ui/use-toast" // Import useToast
import { useState } from "react" // Import useState for search

export default function Sidebar() {
  const { sessions, currentSession, selectSession, startNewChat, deleteSession, createNewSession } = useChat() // Added createNewSession
  const { toast } = useToast() // Initialize useToast
  const [searchTerm, setSearchTerm] = useState("") // State for search term

  const handleDelete = async (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation() // Prevent selecting the session when clicking delete
    if (window.confirm("Are you sure you want to delete this chat session?")) {
      try {
        await deleteSession(sessionId)
        toast({
          title: "Chat Deleted",
          description: "The chat session has been successfully removed.",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete chat session.",
          variant: "destructive",
        })
      }
    }
  }

  const filteredSessions = sessions.filter(session =>
    session.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          <img 
            src="/Diabot-Logo.png" 
            alt="Diabot Logo" 
            className="h-8 w-8 mr-2 drop-shadow-md" 
          />
          <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
        </div>
        <div className="flex items-center gap-2"> 
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => createNewSession()} 
            className="flex items-center space-x-1 hover:bg-blue-50 transition-colors flex-shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="sr-only">New Chat</span>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search chats..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Chat Sessions */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="p-4 pb-2 flex-shrink-0">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
            <MessageCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            Recent Chats
          </h3>
        </div>

        <ScrollArea className="flex-1 px-4 overflow-y-auto">
          <div className="pr-2 pb-4">
            {filteredSessions.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No chats found</p>
                {searchTerm && <p className="text-xs text-gray-400">Try a different search term</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map((session) => {
                  // Truncate title to first 30 characters
                  const truncatedTitle = (session.title || 'Untitled Chat').length > 30 
                    ? `${(session.title || 'Untitled Chat').substring(0, 27)}...`
                    : (session.title || 'Untitled Chat');
                    
                  return (
                    <div
                      key={session.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between w-full ${
                        currentSession?.id === session.id
                          ? "bg-blue-50 border border-blue-200"
                          : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      <div 
                        className="flex-1 min-w-0 pr-2 overflow-hidden"
                        onClick={() => selectSession(session.id)}
                      >
                        <h4 className="text-sm font-medium text-gray-900 truncate" title={session.title || 'Untitled Chat'}>
                          {truncatedTitle}
                        </h4>
                        <div className="flex items-center mt-1 text-xs text-gray-400">
                          <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate">
                            {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDelete(e, session.id)}
                        className="h-6 w-6 p-0 flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Delete chat"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
