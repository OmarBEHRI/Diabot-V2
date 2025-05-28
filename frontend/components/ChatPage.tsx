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
    <div className="h-screen flex overflow-hidden bg-gray-50"> {/* Added overflow-hidden to prevent whole page scrolling */}
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col"> {/* Removed overflow-hidden to allow scrolling */}
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden"> {/* Changed to overflow-hidden */}
        {/* Header - Fixed at the top */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
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

        {/* Chat Area - Only this should scroll */}
        <div className="flex-1 overflow-hidden"> {/* Container with no scroll */}
          {/* ChatWindow takes remaining space and is the only scrollable element */}
          <div className="h-full overflow-y-auto pb-[120px]"> {/* Added height: 100% and moved padding here */}
            <ChatWindow />
          </div>
        </div>
        
        {/* MessageInput is fixed at the bottom of the viewport */}
        <div className="border-t border-gray-200 bg-white fixed bottom-0 left-80 right-0 z-20 shadow-md"> {/* Changed to fixed positioning */}
          <MessageInput />
        </div>
      </div>
    </div>
  )
}
