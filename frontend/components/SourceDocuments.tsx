import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { FileText, X } from "lucide-react";
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
      console.log('Sources array contents:', JSON.stringify(sources, null, 2));
      // Use the sources as-is without modifications
      setProcessedSources(sources);
      return;
    }
    
    try {
      console.log('Parsing sources from string:', sources);
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
      console.log('Processed sources details:', processedSources);
    }
  }, [processedSources]);

  // Reset full text content when dialog closes
  useEffect(() => {
    if (!isDialogOpen) {
      console.log('Dialog closed, resetting fullTextContent');
      setFullTextContent(null);
    } else {
      console.log('Dialog opened, current fullTextContent:', fullTextContent);
    }
  }, [isDialogOpen]);

  // Memoized handler for source click
  const handleSourceClick = useCallback((source: SourceDocument) => {
    console.log('Source clicked:', source);
    setSelectedSource(source);
    setIsDialogOpen(true);
    
    // Log the available content for debugging
    console.log('Source content available:', {
      preview: source.preview ? `${source.preview.substring(0, 50)}...` : 'undefined',
      text: source.text ? `${source.text.substring(0, 50)}...` : 'undefined'
    });
    
    // Directly use the text field since we now have proper full text from the backend
    const content = source.text || source.preview || 'Full text not available';
    console.log('Setting fullTextContent to:', content);
    setFullTextContent(content);
  }, []);

  useEffect(() => {
    console.log('fullTextContent updated:', fullTextContent);
  }, [fullTextContent]);

  if (!processedSources || processedSources.length === 0) {
    console.log('No processed sources to display, returning null');
    return null;
  }

  console.log('Rendering SourceDocuments with', processedSources.length, 'sources');
  
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
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col" aria-describedby="source-content-description">
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
