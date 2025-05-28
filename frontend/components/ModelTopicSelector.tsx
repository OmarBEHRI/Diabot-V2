"use client"

import { useState } from "react"
import { useChat } from "@/context/ChatContext"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Brain, Target, Plus } from "lucide-react"

interface ModelTopicSelectorProps {
  showCreateButton?: boolean
}

export default function ModelTopicSelector({ showCreateButton = false }: ModelTopicSelectorProps) {
  const { 
    models, 
    topics, 
    selectedModel, 
    selectedTopic, 
    setSelectedModel, 
    setSelectedTopic, 
    createNewSession,
    isLoadingModels,
    isLoadingTopics,
    isLoading
  } = useChat()
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [initialMessage, setInitialMessage] = useState("")

  const handleCreateSession = async () => {
    if (!initialMessage.trim()) return
    
    try {
      await createNewSession(initialMessage)
      setIsDialogOpen(false)
      setInitialMessage("")
    } catch (error) {
      console.error("Error creating session:", error)
    }
  }

  return (
    <div className="flex items-center space-x-4">
      {/* Model Selection */}
      <div className="flex items-center space-x-2">
        <Brain className="h-4 w-4 text-blue-500" />
        <Select
          value={selectedModel?.id.toString() || ""}
          onValueChange={(value) => {
            const model = models.find((m) => m.id.toString() === value)
            if (model) setSelectedModel(model)
          }}
          disabled={isLoadingModels}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={isLoadingModels ? "Loading..." : "Select AI Model"} />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id.toString()}>
                <div className="flex items-center justify-between w-full">
                  <span>{model.display_name}</span>
                  <Badge variant="secondary" className="ml-2">
                    {Math.round(model.accuracy_rag * 100)}%
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Topic Selection */}
      <div className="flex items-center space-x-2">
        <Target className="h-4 w-4 text-green-500" />
        <Select
          value={selectedTopic?.id.toString() || ""}
          onValueChange={(value) => {
            const topic = topics.find((t) => t.id.toString() === value)
            if (topic) setSelectedTopic(topic)
          }}
          disabled={isLoadingTopics}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={isLoadingTopics ? "Loading..." : "Select Medical Topic"} />
          </SelectTrigger>
          <SelectContent>
            {topics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id.toString()}>
                {topic.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Create Session Button */}
      {showCreateButton && selectedModel && selectedTopic && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="medical-gradient">
              <Plus className="h-4 w-4 mr-2" />
              Start Chat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start New Chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Model: <span className="font-medium">{selectedModel.display_name}</span>
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Topic: <span className="font-medium">{selectedTopic.name}</span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  What would you like to ask?
                </label>
                <Input
                  placeholder="Type your medical question here..."
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleCreateSession()
                    }
                  }}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateSession} 
                  disabled={!initialMessage.trim() || isLoading}
                  className="medical-gradient"
                >
                  {isLoading ? "Creating..." : "Start Chat"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
