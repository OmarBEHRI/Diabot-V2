import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { FileText, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
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
  const [isLoadingFullText, setIsLoadingFullText] = useState(false);

  // Process sources when they change
  useEffect(() => {
    console.log('SourceDocuments received sources:', sources);
    
    if (!sources) {
      console.log('No sources provided');
      setProcessedSources([]);
      return;
    }
    
    if (Array.isArray(sources)) {
      console.log(`Sources is an array with ${sources.length} items`);
      // Use the sources as-is without modifications
      setProcessedSources(sources);
      return;
    }
    
    try {
      console.log('Parsing sources from string...');
      const parsed = JSON.parse(sources);
      console.log('Successfully parsed sources:', parsed);
      // Set the parsed sources
      setProcessedSources(Array.isArray(parsed) ? parsed : [parsed]);
    } catch (e) {
      console.error('Error parsing sources:', e);
      console.error('Source string that failed to parse:', sources);
      setProcessedSources([]);
    }
  }, [sources]);

  // Log when sources are ready
  useEffect(() => {
    if (processedSources && processedSources.length > 0) {
      console.log('Sources are processed and ready to display:', processedSources.length);
    }
  }, [processedSources]);

  // Reset full text content when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      setFullTextContent(null);
    }
  }, [isDialogOpen]);

  // Memoized handler for source click
  const handleSourceClick = useCallback((source: SourceDocument) => {
    console.log('Source clicked:', source);
    setSelectedSource(source);
    setIsDialogOpen(true);
    
    // Since we don't have a backend endpoint for full text, we'll use what we have
    // Set a very brief loading state for UI feedback
    setIsLoadingFullText(true);
    
    // Use a timeout to simulate loading and provide better UX
    setTimeout(() => {
      // Log the available content for debugging
      console.log('Source content available:', {
        preview: source.preview?.substring(0, 50) + '...',
        text: source.text?.substring(0, 50) + '...',
        full_text: source.full_text?.substring(0, 50) + '...',
        content: source.content?.substring(0, 50) + '...'
      });
      
      // For now, we'll use the text field as is, since the backend doesn't have a full text endpoint
      // In a real implementation, this would be replaced with the actual full text from the backend
      setFullTextContent(source.text || source.preview || 'Full text not available. The backend API endpoint for retrieving full text is not implemented.');
      setIsLoadingFullText(false);
    }, 500); // Short delay for better UX
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
                  <div className="text-xs text-muted-foreground">
                    Page: {source.page}
                    {source.chapter && ` • ${source.chapter}`}
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
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col" aria-describedby="source-content-description">
          {selectedSource && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-center">
                  <DialogTitle className="text-lg">
                    {selectedSource.source}
                  </DialogTitle>
                  <span className="text-sm text-muted-foreground">
                    Page: {selectedSource.page}
                    {selectedSource.chapter && ` • ${selectedSource.chapter}`}
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
                {isLoadingFullText ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
                    <p className="text-sm text-muted-foreground">Loading full content...</p>
                  </div>
                ) : (
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap">
                      {/* Display the full text content if available, otherwise fall back to other fields */}
                      {fullTextContent || 
                       selectedSource.full_text || 
                       selectedSource.fullText || 
                       selectedSource.full_content || 
                       selectedSource.content || 
                       selectedSource.text || 
                       'No content available'}
                    </p>
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SourceDocuments;
