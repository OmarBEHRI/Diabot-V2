"use client"

/**
 * Root Page Component
 * 
 * Serves as the application entry point that:
 * - Automatically redirects users to the homepage
 * - Displays a loading spinner during authentication check
 * - Handles routing based on authentication state
 */

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"

export default function RootPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    // First direct users to the homepage
    if (!isLoading) {
      router.push('/home')
    }
  }, [isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
    </div>
  )
}
