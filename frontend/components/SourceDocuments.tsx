import React from 'react';
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { FileText } from "lucide-react";

export interface SourceDocument {
  text: string;
  source: string;
  page: string | number;
  score?: string | number;
}

interface SourceDocumentsProps {
  sources: SourceDocument[];
  className?: string;
}

export function SourceDocuments({ sources, className = "" }: SourceDocumentsProps) {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className={`mt-4 ${className}`}>
      <h3 className="text-sm font-medium mb-2 flex items-center text-muted-foreground">
        <FileText className="h-4 w-4 mr-2" />
        Sources
      </h3>
      <ScrollArea className="h-48 rounded-md border">
        <div className="p-4 space-y-3">
          {sources.map((source, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-sm font-medium leading-none">
                    {source.source}
                  </CardTitle>
                  {source.score !== undefined && (
                    <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                      {typeof source.score === 'number' 
                        ? (source.score * 100).toFixed(0) + '%' 
                        : source.score}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Page: {source.page}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm line-clamp-3">
                  {source.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default SourceDocuments;
