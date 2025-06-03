"use client"

/**
 * Chat Route Page
 * 
 * Main chat interface route that handles authentication checking and redirects.
 * Displays the chat interface for authenticated users or redirects to login page.
 */

import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import ChatPage from "@/components/ChatPage"

export default function ChatRoute() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return user ? <ChatPage /> : null
}
