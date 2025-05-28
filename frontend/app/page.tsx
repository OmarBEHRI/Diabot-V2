"use client"

import { useAuth } from "@/context/AuthContext"
import AuthPage from "@/components/AuthPage"
import ChatPage from "@/components/ChatPage"

export default function Home() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return user ? <ChatPage /> : <AuthPage />
}
