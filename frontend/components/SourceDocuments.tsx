import React, { useState, useMemo } from 'react';
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { cn } from "@/lib/utils";

export interface SourceDocument {
  source: string;
  page: string | number;
  chapter?: string;
  relevance?: number;
  preview?: string;
  text?: string; // Fallback for backward compatibility
}

interface SourceDocumentsProps {
  sources: SourceDocument[] | string;
  className?: string;
}

export function SourceDocuments({ sources, className = "" }: SourceDocumentsProps) {
  const [selectedSource, setSelectedSource] = useState<SourceDocument | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Handle case where sources is a string (JSON) or already an array
  const sourceList: SourceDocument[] = useMemo(() => {
    console.log('🔍 SourceDocuments received sources:', sources);
    
    if (!sources) {
      console.log('⚠️ No sources provided');
      return [];
    }
    
    if (Array.isArray(sources)) {
      console.log(`✅ Sources is an array with ${sources.length} items`);
      return sources;
    }
    
    try {
      console.log('🔄 Parsing sources from string...');
      const parsed = JSON.parse(sources);
      console.log('✅ Successfully parsed sources:', parsed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.error('❌ Error parsing sources:', e);
      console.error('Source string that failed to parse:', sources);
      return [];
    }
  }, [sources]);

  if (!sourceList || sourceList.length === 0) {
    return null;
  }

  const handleSourceClick = (source: SourceDocument) => {
    setSelectedSource(source);
    setIsDialogOpen(true);
  };

  return (
    <div className={cn("mt-4", className)}>
      <h3 className="text-sm font-medium mb-2 flex items-center text-muted-foreground">
        <FileText className="h-4 w-4 mr-2" />
        Sources ({sourceList.length})
      </h3>
      <ScrollArea className="h-48 rounded-md border">
        <div className="p-4 space-y-3">
          {sourceList.map((source, index) => (
            <div 
              key={index} 
              onClick={() => handleSourceClick(source)}
              className="cursor-pointer hover:opacity-80 transition-opacity"
            >
              <Card className="overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-medium leading-none">
                      {source.source}
                    </CardTitle>
                    {source.relevance !== undefined && (
                      <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                        {Math.round(source.relevance * 100)}%
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
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
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
                    {selectedSource.relevance !== undefined && (
                      <span className="ml-2 px-2 py-1 bg-secondary rounded-full text-xs">
                        Relevance: {Math.round(selectedSource.relevance * 100)}%
                      </span>
                    )}
                  </span>
                </div>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4 -mr-4">
                <div className="prose dark:prose-invert max-w-none">
                  <p className="whitespace-pre-wrap">
                    {selectedSource.preview || selectedSource.text || 'No content available'}
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
