"use client"

/**
 * Authentication Page Component
 * 
 * Provides user interface for authentication with the following features:
 * - Tabbed interface for login and registration
 * - Form validation and error handling
 * - Success notifications via toast messages
 * - Automatic redirection after successful authentication
 * - Integration with the Diabot logo for branding
 */

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Heart, Shield, Stethoscope } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function AuthPage() {
  const { login, register, isLoading } = useAuth()
  const router = useRouter() // Initialize useRouter
  const { toast } = useToast() // Initialize useToast
  const [loginForm, setLoginForm] = useState({ username: "", password: "" })
  const [registerForm, setRegisterForm] = useState({ username: "", password: "" })
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      await login(loginForm.username, loginForm.password)
      router.push("/chat") // Redirect to chat page on successful login
    } catch (err: any) { // Type error as any to access response
      setError(err.message || "Invalid credentials") // Display specific error from backend
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      await register(registerForm.username, registerForm.password)
      toast({ // Show success toast
        title: "Registration Successful!",
        description: "You can now sign in with your new account.",
      })
      router.push("/chat") // Redirect to chat page on successful registration
    } catch (err: any) { // Type error as any to access response
      setError(err.message || "Registration failed") // Display specific error from backend
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img 
              src="/Diabot-Logo.png" 
              alt="Diabot Logo" 
              className="h-28 w-28 drop-shadow-lg" 
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Diabot</h1>
          <p className="text-gray-600">Your AI-powered diabetes assistant</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to your account or create a new one to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                    />
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <Button type="submit" className="w-full medical-gradient" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Username</Label>
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="Create username"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Create password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                      required
                    />
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <Button type="submit" className="w-full medical-gradient" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          By using MedChat AI, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
