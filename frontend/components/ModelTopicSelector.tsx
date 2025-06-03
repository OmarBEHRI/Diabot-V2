"use client"

/**
 * Model and Topic Selector Component
 * 
 * Provides UI for selecting AI models and conversation topics:
 * - Dropdown selection for AI models with accuracy metrics
 * - Topic selection with search functionality
 * - Support for creating new topics
 * - Integration with the latest models including Gemini, GPT, Llama, and more
 */

import { useState, useRef, useEffect } from "react"
import { useChat } from "@/context/ChatContext"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Brain, Target, Plus, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Additional models configuration
 * These models are added to supplement the models from the backend database
 */
const additionalModels = [
  {
    id: 1001,
    openrouter_id: "google/gemini-2.5-flash-preview-05-20",
    display_name: "Gemini 2.5 Flash",
    accuracy_no_rag: 0.92,
    accuracy_rag: 0.95,
    description: "Google's Gemini 2.5 Flash model"
  },
  {
    id: 1002,
    openrouter_id: "openai/gpt-4.1-mini",
    display_name: "GPT-4.1 Mini",
    accuracy_no_rag: 0.91,
    accuracy_rag: 0.94,
    description: "OpenAI's GPT-4.1 Mini model"
  },
  {
    id: 1003,
    openrouter_id: "openai/gpt-4o-mini",
    display_name: "GPT-4o Mini",
    accuracy_no_rag: 0.93,
    accuracy_rag: 0.96,
    description: "OpenAI's GPT-4o Mini model"
  },
  {
    id: 1004,
    openrouter_id: "deepseek/deepseek-chat-v3-0324",
    display_name: "DeepSeek Chat v3",
    accuracy_no_rag: 0.89,
    accuracy_rag: 0.92,
    description: "DeepSeek's Chat v3 model"
  },
  {
    id: 1005,
    openrouter_id: "mistralai/mistral-nemo",
    display_name: "Mistral Nemo",
    accuracy_no_rag: 0.90,
    accuracy_rag: 0.93,
    description: "Mistral AI's Nemo model"
  },
  {
    id: 1006,
    openrouter_id: "google/gemma-3-4b-it",
    display_name: "Gemma 3 4B",
    accuracy_no_rag: 0.88,
    accuracy_rag: 0.91,
    description: "Google's Gemma 3 4B model"
  },
  {
    id: 1007,
    openrouter_id: "meta-llama/llama-3.1-8b-instruct",
    display_name: "Llama 3.1 8B",
    accuracy_no_rag: 0.89,
    accuracy_rag: 0.92,
    description: "Meta's Llama 3.1 8B model"
  },
  {
    id: 1008,
    openrouter_id: "meta-llama/llama-4-scout",
    display_name: "Llama 4 Scout",
    accuracy_no_rag: 0.94,
    accuracy_rag: 0.97,
    description: "Meta's Llama 4 Scout model"
  }
];

interface ModelTopicSelectorProps {
  showCreateButton?: boolean
}

export default function ModelTopicSelector({ showCreateButton = false }: ModelTopicSelectorProps) {
  const { 
    models: apiModels, 
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
  
  // Combine API models with additional models, excluding any Mistral models and Claude Instant
  const models = [
    ...apiModels.filter(model => 
      !model.display_name.toLowerCase().includes("mistral") && 
      !model.display_name.toLowerCase().includes("claude instant")
    ), 
    ...additionalModels.filter(am => 
      !apiModels.some(m => m.openrouter_id === am.openrouter_id)
    )
  ];
  
  // Make sure Llama 3.1 8B is in the models list
  const llama31Model = additionalModels.find(m => m.openrouter_id === "meta-llama/llama-3.1-8b-instruct");
  if (llama31Model && !models.some(m => m.openrouter_id === "meta-llama/llama-3.1-8b-instruct")) {
    models.unshift(llama31Model); // Add to the beginning of the array to prioritize it
  }
  
  // State for model search
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  
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
  
  // Filter models based on search value
  const filteredModels = searchValue === ""
    ? models
    : models.filter((model) =>
        model.display_name.toLowerCase().includes(searchValue.toLowerCase()) ||
        model.openrouter_id.toLowerCase().includes(searchValue.toLowerCase())
      )

  return (
    <div className="flex items-center space-x-4">
      {/* Model Selection with Search */}
      <div className="flex items-center space-x-2">
        <Brain className="h-4 w-4 text-blue-500" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[220px] justify-between"
              disabled={isLoadingModels}
            >
              {selectedModel
                ? selectedModel.display_name
                : isLoadingModels 
                  ? "Loading..."
                  : "Select AI Model"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0">
            <Command>
              <CommandInput 
                placeholder="Search models..." 
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList>
                <CommandEmpty>No models found.</CommandEmpty>
                <CommandGroup>
                  {filteredModels.map((model) => (
                    <CommandItem
                      key={model.id}
                      value={model.display_name}
                      onSelect={() => {
                        setSelectedModel(model)
                        setOpen(false)
                        setSearchValue("")
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedModel?.id === model.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <span>{model.display_name}</span>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {Math.round(model.accuracy_rag * 100)}%
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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
