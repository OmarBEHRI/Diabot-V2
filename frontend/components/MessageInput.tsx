"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useChat } from "@/context/ChatContext"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Loader2, Brain, ChevronsUpDown, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

export default function MessageInput() {
  const { 
    sendMessage, 
    isLoading, 
    currentSession, 
    createNewSession,
    models,
    selectedModel,
    setSelectedModel,
    isLoadingModels
  } = useChat()
  const [input, setInput] = useState("")
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return // Removed !currentSession check here

    const message = input.trim()
    setInput("")

    if (!currentSession) {
      // If no current session, create a new one with this message
      await createNewSession(message)
    } else {
      // Otherwise, send message to existing session
      await sendMessage(message)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
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
    <div className="p-6 w-full">
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
          <div className="flex items-center space-x-2">
            {/* Model selector */}
            <div className="flex-shrink-0">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    role="combobox"
                    aria-expanded={open}
                    className="h-10 rounded-full border border-gray-200 shadow-sm bg-white/90 backdrop-blur-sm hover:bg-gray-50 transition-all"
                    disabled={isLoadingModels}
                  >
                    <Brain className="h-4 w-4 text-emerald-500 mr-1" />
                    {selectedModel
                      ? <span className="flex items-center text-xs">
                          <span className="max-w-[60px] truncate">{selectedModel.display_name}</span>
                          <Badge variant="secondary" className="ml-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] px-1 py-0 h-4">
                            {Math.round(selectedModel.accuracy_rag * 100)}%
                          </Badge>
                        </span>
                      : isLoadingModels 
                        ? "..."
                        : "AI"}
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
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
                              <Badge variant="secondary" className="ml-2 bg-emerald-50 text-emerald-700">
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
            
            {/* Message input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a medical question..."
              className="h-10 py-2 px-4 focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm flex-grow rounded-full border border-gray-200 mx-2"
              disabled={isLoading}
            />
            
            {/* Send button */}
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-full h-10 w-10 flex items-center justify-center p-0"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>

        <p className="text-xs text-gray-500 mt-2 text-center">Press Enter to send</p>
      </div>
    </div>
  )
}
