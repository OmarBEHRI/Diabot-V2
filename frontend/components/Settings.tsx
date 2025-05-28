"use client"

import { useState, useEffect } from 'react';
import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { Settings as SettingsIcon } from "lucide-react"

export default function Settings() {
  const { user, updateUser } = useAuth()
  const { models, selectedModel, setSelectedModel } = useChat()
  
  // Initialize username with user's current username
  const [darkMode, setDarkMode] = useState(false)
  const [username, setUsername] = useState(user?.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Update username when user changes
  useEffect(() => {
    if (user?.username) {
      setUsername(user.username)
    }
  }, [user?.username])

  useEffect(() => {
    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem('theme')
    setDarkMode(savedTheme === 'dark')
    
    // Apply theme
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light')
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const handleDeleteChatHistory = async () => {
    if (window.confirm('Are you sure you want to delete all chat history? This action cannot be undone.')) {
      try {
        const response = await fetch('/api/chat/history', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) throw new Error('Failed to delete chat history')
        
        // Refresh the chat interface or handle as needed
        window.location.reload()
      } catch (error) {
        console.error('Error deleting chat history:', error)
        toast({
          title: "Error",
          description: "Failed to delete chat history",
          variant: "destructive",
        })
      }
    }
  }

  const handleUpdateUsername = async () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Username cannot be empty",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/user/username', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ username }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to update username')
      }
      
      // Update the user context with the new username
      updateUser({ username })
      
      toast({
        title: "Success",
        description: "Username updated successfully",
      })
    } catch (error) {
      console.error('Error updating username:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update username",
        variant: "destructive",
      })
    }
  }

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (!response.ok) throw new Error('Failed to update password')
      
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      
      toast({
        title: "Success",
        description: "Password updated successfully",
      })
    } catch (error) {
      console.error('Error updating password:', error)
      toast({
        title: "Error",
        description: "Failed to update password. Please check your current password.",
        variant: "destructive",
      })
    }
  }

  const handleModelChange = (modelId: string) => {
    const model = models.find(m => m.id.toString() === modelId)
    if (model) {
      setSelectedModel(model)
      localStorage.setItem('defaultModel', modelId)
      toast({
        title: "Default model updated",
        description: `${model.display_name} is now your default model`,
      })
    }
  }

  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDialogOpen(true);
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start"
            onClick={handleTriggerClick}
          >
            <SettingsIcon className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto"
        onInteractOutside={(e) => {
          // Only close when clicking outside the dialog, not when clicking on the dropdown
          const target = e.target as HTMLElement;
          if (!target.closest('.dropdown-menu-content')) {
            setDialogOpen(false);
          } else {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={() => setDialogOpen(false)}
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your account and application preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Toggle between light and dark theme
              </p>
            </div>
            <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
          </div>

          {/* Default Model Selection */}
          <div className="space-y-2">
            <Label>Default Model</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedModel?.id || ''}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Username Update */}
          <div className="space-y-2">
            <Label>Username</Label>
            <div className="flex space-x-2">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter new username"
              />
              <Button onClick={handleUpdateUsername}>Update</Button>
            </div>
          </div>

          {/* Password Update */}
          <div className="space-y-2">
            <Label>Change Password</Label>
            <div className="space-y-3">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
              />
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              <Button onClick={handleUpdatePassword} className="w-full">
                Update Password
              </Button>
            </div>
          </div>

          {/* Delete Chat History */}
          <div className="pt-4 border-t">
            <div className="space-y-2">
              <Label className="text-destructive">Danger Zone</Label>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Delete All Chat History</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all your chat history
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDeleteChatHistory}
                >
                  Delete All
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </div>
  )
}
