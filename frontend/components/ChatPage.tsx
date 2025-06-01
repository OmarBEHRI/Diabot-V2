"use client"

import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import Sidebar from "./Sidebar"
import ChatWindow from "./ChatWindow"
import MessageInput from "./MessageInput"
import NavigationBar from "./NavigationBar"
import { Button } from "@/components/ui/button"
import { LogOut, Menu, User, X, Settings as SettingsIcon } from "lucide-react"
import Settings from "./Settings"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ChatPage() {
  const router = useRouter();
  const { user, logout } = useAuth()
  const { 
    currentSession, 
    selectedModel, 
    selectedTopic, 
    createNewSession, 
    isLoadingModels, 
    isLoadingTopics,
    sessions
  } = useChat()
  
  // State for sidebar visibility on mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  
  // Check if we're on mobile when component mounts and when window resizes
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768) // 768px is typical md breakpoint
    }
    
    // Initial check
    checkIsMobile()
    
    // Add resize listener
    window.addEventListener('resize', checkIsMobile)
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])
  
  // Close sidebar when a session is selected on mobile
  useEffect(() => {
    if (isMobile && currentSession) {
      setIsSidebarOpen(false)
    }
  }, [currentSession, isMobile])

  // The session initialization logic has been moved to ChatContext

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50"> {/* Added overflow-hidden to prevent whole page scrolling */}
      {/* Mobile sidebar toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`md:hidden fixed top-4 left-4 z-30 ${isSidebarOpen ? 'text-white' : ''}`}
      >
        {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>
      
      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`${isMobile ? 'fixed inset-y-0 left-0 z-30' : 'relative'} 
                   w-[280px] bg-white border-r border-gray-200 flex flex-col
                   transition-transform duration-300 ease-in-out
                   ${isMobile && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}`}
      >
        <Sidebar />
      </div>

      {/* Navigation Bar */}
      <NavigationBar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden md:ml-0">

        {/* Chat Area - Only this should scroll */}
        <div className="flex-1 overflow-hidden"> {/* Container with no scroll */}
          {/* ChatWindow takes remaining space and is the only scrollable element */}
          <div className="h-full overflow-y-auto pb-[120px]"> {/* Added height: 100% and moved padding here */}
            <ChatWindow />
          </div>
        </div>
        
        {/* MessageInput is fixed at the bottom of the viewport */}
        <div className="border-t border-gray-200 bg-white fixed bottom-0 right-0 z-20 shadow-md"
             style={{ left: isMobile ? '0' : '280px' }} // Dynamic left position based on sidebar state
        > 
          <MessageInput />
        </div>
      </div>
    </div>
  )
}
