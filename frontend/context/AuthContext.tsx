"use client"

/**
 * Authentication Context
 * 
 * Provides global authentication state and functions throughout the application:
 * - User authentication (login, register, logout)
 * - Token management and persistence
 * - User profile data storage
 * - Loading state management
 * - Protected route handling
 */

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { authAPI } from "../lib/api"


interface User {
  id: string
  username: string
  email?: string
  avatar?: string
  firstName?: string
  lastName?: string
  bio?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (userData: Partial<User>) => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem("token")
    const storedUser = localStorage.getItem("user")

    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await authAPI.login(username, password)
      
      const user = { id: response.user.id.toString(), username: response.user.username }
      const token = response.token

      setUser(user)
      setToken(token)
      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))
    } catch (error) {
      throw new Error("Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await authAPI.register(username, password)
      
      const user = { id: response.user.id.toString(), username: response.user.username }
      const token = response.token

      setUser(user)
      setToken(token)
      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))
    } catch (error) {
      throw new Error("Registration failed")
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    // Redirect should be handled in the component after logout
  }

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData }
      setUser(updatedUser)
      localStorage.setItem("user", JSON.stringify(updatedUser))
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, isLoading }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
