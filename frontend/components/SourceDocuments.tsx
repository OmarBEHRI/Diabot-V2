/**
 * SourceDocuments Component
 * 
 * Displays and manages source documents retrieved from RAG context in chat responses.
 * Provides a list view of sources with relevance scores and a modal dialog for viewing
 * the full content of each source document.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { cn } from "@/lib/utils";
import { chatAPI } from "@/lib/api";

export interface SourceDocument {
  source: string;
  page: string | number;
  chapter?: string;
  score?: number | string;
  relevance?: number | string; // Added relevance field from backend
  preview?: string;
  text?: string; // Main content text
  full_text?: string; // Full text content from backend
  fullText?: string; // Alternative field name
  full_content?: string; // Alternative field name
  content?: string; // Alternative field name
}

interface SourceDocumentsProps {
  sources: SourceDocument[] | string;
  className?: string;
}

export function SourceDocuments({ sources, className = "" }: SourceDocumentsProps) {
  const [selectedSource, setSelectedSource] = useState<SourceDocument | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processedSources, setProcessedSources] = useState<SourceDocument[]>([]);
  const [fullTextContent, setFullTextContent] = useState<string | null>(null);

  useEffect(() => {    
    if (!sources) {
      setProcessedSources([]);
      return;
    }
    
    if (Array.isArray(sources)) {
      setProcessedSources(sources);
      return;
    }
    
    try {
      const parsed = JSON.parse(sources);
      setProcessedSources(Array.isArray(parsed) ? parsed : [parsed]);
    } catch (e) {
      setProcessedSources([]);
    }
  }, [sources]);

  // Reset full text content when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      setFullTextContent(null);
    }
  }, [isDialogOpen]);

  const handleSourceClick = useCallback((source: SourceDocument) => {
    setSelectedSource(source);
    setIsDialogOpen(true);
    
    const content = source.text || source.preview || 'Full text not available';
    setFullTextContent(content);
  }, []);

  if (!processedSources || processedSources.length === 0) {
    return null;
  }
  
  return (
    <div className={cn("mt-4", className)}>
      <h3 className="text-sm font-medium mb-2 flex items-center text-muted-foreground">
        <FileText className="h-4 w-4 mr-2" />
        Sources ({processedSources.length})
      </h3>
      <ScrollArea className="h-48 rounded-md border">
        <div className="p-4 space-y-3">
          {processedSources.map((source, index) => (
            <div 
              key={`source-${index}-${source.source}`} 
              onClick={() => handleSourceClick(source)}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Card className="overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-medium leading-none">
                      {source.source}
                    </CardTitle>
                    {source.score !== undefined && (
                      <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                        {/* Display score as percentage - handle both number and string formats */}
                        {typeof source.score === 'number' && source.score <= 1
                          ? Math.round(source.score * 100)
                          : typeof source.score === 'number'
                            ? Math.round(source.score)
                            : typeof source.score === 'string' && parseFloat(source.score) <= 1
                              ? Math.round(parseFloat(source.score) * 100)
                              : typeof source.score === 'string'
                                ? Math.round(parseFloat(source.score))
                                : 0}%
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm line-clamp-2 text-muted-foreground">
                    {source.preview || source.text || 'No preview available'}
                  </p>
                  <div className="text-xs text-blue-500 mt-1">
                    Click to view full content
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Source Detail Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col w-[95vw] h-[85vh]" aria-describedby="source-content-description">
          {selectedSource && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-center">
                  <DialogTitle className="text-lg">
                    {selectedSource.source}
                  </DialogTitle>
                  <span className="text-sm text-muted-foreground">
                    {(selectedSource.score !== undefined || selectedSource.relevance !== undefined) && (
                      <span className="ml-2 px-2 py-1 bg-secondary rounded-full text-xs">
                        Relevance: {
                          // First check relevance field
                          selectedSource.relevance !== undefined ?
                            (typeof selectedSource.relevance === 'number' && selectedSource.relevance <= 1
                              ? Math.round(selectedSource.relevance * 100)
                              : typeof selectedSource.relevance === 'number'
                                ? Math.round(selectedSource.relevance)
                                : typeof selectedSource.relevance === 'string' && parseFloat(selectedSource.relevance) <= 1
                                  ? Math.round(parseFloat(selectedSource.relevance) * 100)
                                  : typeof selectedSource.relevance === 'string'
                                    ? Math.round(parseFloat(selectedSource.relevance))
                                    : 0)
                          // Then fall back to score field
                          : (typeof selectedSource.score === 'number' && selectedSource.score <= 1
                              ? Math.round(selectedSource.score * 100)
                              : typeof selectedSource.score === 'number'
                                ? Math.round(selectedSource.score)
                                : typeof selectedSource.score === 'string' && parseFloat(selectedSource.score) <= 1
                                  ? Math.round(parseFloat(selectedSource.score) * 100)
                                  : typeof selectedSource.score === 'string'
                                    ? Math.round(parseFloat(selectedSource.score))
                                    : 0)
                        }%
                      </span>
                    )}
                  </span>
                </div>
              </DialogHeader>
              <div id="source-content-description" className="sr-only">Source document content from {selectedSource.source}</div>
              <ScrollArea className="flex-1 pr-4 -mr-4">
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">
                    {/* Display the full text content if available, otherwise fall back to other fields */}
                    {fullTextContent || 
                     selectedSource.text || 
                     selectedSource.preview || 
                     'No content available'}
                  </p>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SourceDocuments;
