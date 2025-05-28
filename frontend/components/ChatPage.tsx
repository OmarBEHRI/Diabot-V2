"use client"

import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import Sidebar from "./Sidebar"
import ChatWindow from "./ChatWindow"
import MessageInput from "./MessageInput"
import ModelTopicSelector from "./ModelTopicSelector"
import { Button } from "@/components/ui/button"
import { LogOut, Settings, User } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export default function ChatPage() {
  const { user, logout } = useAuth()
  const { currentSession, selectedModel, selectedTopic, createNewSession } = useChat()

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative"> {/* Added relative for absolute positioning */}
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">MedChat AI</h1>
            {selectedModel && selectedTopic && (
              <div className="text-sm text-gray-500">
                {selectedModel.display_name} • {selectedTopic.name}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <ModelTopicSelector /> {/* Always show ModelTopicSelector */}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <User className="h-4 w-4" />
                  <span>{user?.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col pb-[120px]"> {/* Added padding bottom to make space for fixed input */}
          {/* ChatWindow takes remaining space and scrolls */}
          <div className="flex-1 overflow-y-auto min-h-0"> {/* Added min-h-0 */}
            <ChatWindow />
          </div>
        </div>
        
        {/* MessageInput is fixed at the bottom */}
        <div className="border-t border-gray-200 bg-white absolute bottom-0 left-0 right-0 z-10 shadow-md">
          <MessageInput />
        </div>
      </div>
    </div>
  )
}
