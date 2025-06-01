"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NavigationBar from "@/components/NavigationBar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Menu, X, BarChart3, BarChart2, FileText, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

// Define benchmark result types
interface ModelResult {
  model: string;
  timestamp: string;
  accuracy: number;
  total_questions: number;
  correct_answers: number;
  processing_time_seconds?: number;
}

export default function BenchmarksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("multiple-choice");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Mock data for multiple choice benchmark results
  const multipleChoiceResults: ModelResult[] = [
    { model: "meta-llama/llama-3.1-8b-instruct", timestamp: "2025-05-29", accuracy: 96.82, total_questions: 157, correct_answers: 152, processing_time_seconds: 340.82 },
    { model: "anthropic/claude-3.7-sonnet", timestamp: "2025-05-29", accuracy: 98.73, total_questions: 157, correct_answers: 155, processing_time_seconds: 412.56 },
    { model: "google/gemini-2.5-flash-preview-05-20", timestamp: "2025-05-29", accuracy: 94.27, total_questions: 157, correct_answers: 148, processing_time_seconds: 287.32 },
    { model: "openai/gpt-4.1-mini", timestamp: "2025-05-29", accuracy: 95.54, total_questions: 157, correct_answers: 150, processing_time_seconds: 325.18 },
    { model: "mistralai/mistral-nemo", timestamp: "2025-05-29", accuracy: 92.36, total_questions: 157, correct_answers: 145, processing_time_seconds: 298.45 },
    { model: "google/gemma-3-4b-it", timestamp: "2025-05-29", accuracy: 82.78, total_questions: 151, correct_answers: 125, processing_time_seconds: 215.67 },
  ];
  
  // Mock data for free-form benchmark results
  const freeFormResults: ModelResult[] = [
    { model: "openai/gpt-4.1-mini", timestamp: "2025-05-29", accuracy: 88.46, total_questions: 156, correct_answers: 138 },
    { model: "google/gemini-2.5-flash-preview-05-20", timestamp: "2025-05-29", accuracy: 87.74, total_questions: 155, correct_answers: 136 },
    { model: "meta-llama/llama-3.1-8b-instruct", timestamp: "2025-05-29", accuracy: 38.71, total_questions: 155, correct_answers: 60 },
    { model: "google/gemma-3-4b-it", timestamp: "2025-05-29", accuracy: 82.78, total_questions: 151, correct_answers: 125 },
    { model: "mistralai/mistral-nemo", timestamp: "2025-05-29", accuracy: 74.19, total_questions: 155, correct_answers: 115 },
    { model: "qwen/qwen-2.5-7b-instruct", timestamp: "2025-05-29", accuracy: 88.39, total_questions: 155, correct_answers: 137 },
    { model: "google/gemini-2.0-flash-001", timestamp: "2025-05-29", accuracy: 92.36, total_questions: 157, correct_answers: 145 },
  ];
  
  // Check if we're on mobile when component mounts and when window resizes
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768) // 768px is typical md breakpoint
    }
    
    // Initial check
    checkIsMobile()
    
    // Add resize listener
    window.addEventListener('resize', checkIsMobile)
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null; // Don't render anything while checking authentication
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Navigation Bar */}
      <NavigationBar />
      
      {/* Mobile sidebar toggle button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className={`md:hidden fixed top-4 left-4 z-30 ${isSidebarOpen ? 'text-white' : ''}`}
      >
        {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>
      
      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-6 pt-20">
          <div className="max-w-7xl mx-auto">
            {/* Info Card */}
            <Card className="mb-6 bg-gradient-to-r from-blue-50 to-emerald-50 border-blue-100">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                  Diabetes Knowledge Benchmark Results
                </CardTitle>
                <CardDescription>
                  Comparing various AI models on their diabetes knowledge using multiple-choice and free-form question benchmarks.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  These benchmarks test AI models on their knowledge of diabetes, including diagnosis, treatment, management, and complications.
                  The multiple-choice test evaluates accuracy on 157 questions with defined answers, while the free-form test assesses the quality
                  of generated explanations on similar topics.
                </p>
              </CardContent>
            </Card>
            
            {/* Tabs for Different Benchmark Types */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b border-gray-200 sticky top-0 bg-white/90 backdrop-blur-sm z-10 pb-0">
                <TabsList className="bg-gray-100 p-1 rounded-lg mb-4">
                  <TabsTrigger 
                    value="multiple-choice" 
                    className={cn(
                      "rounded-md transition-all duration-200",
                      activeTab === "multiple-choice" ? "bg-white shadow-sm" : "hover:bg-gray-200"
                    )}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Multiple Choice
                  </TabsTrigger>
                  <TabsTrigger 
                    value="free-form" 
                    className={cn(
                      "rounded-md transition-all duration-200",
                      activeTab === "free-form" ? "bg-white shadow-sm" : "hover:bg-gray-200"
                    )}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Free-Form Answers
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="multiple-choice" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Multiple Choice Benchmark Results</CardTitle>
                    <CardDescription>
                      Models were tested on 157 multiple-choice questions about diabetes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableCaption>Results sorted by accuracy (highest first)</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>Accuracy</TableHead>
                          <TableHead className="hidden md:table-cell">Correct</TableHead>
                          <TableHead className="hidden md:table-cell">Total</TableHead>
                          <TableHead className="hidden md:table-cell">Processing Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {multipleChoiceResults
                          .sort((a, b) => b.accuracy - a.accuracy)
                          .map((result, index) => (
                            <TableRow key={index} className={index === 0 ? "bg-emerald-50" : ""}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{result.model.split('/')[1]}</span>
                                  <span className="text-xs text-gray-500">{result.model.split('/')[0]}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  result.accuracy > 95 ? "bg-emerald-100 text-emerald-800" :
                                  result.accuracy > 90 ? "bg-blue-100 text-blue-800" :
                                  result.accuracy > 80 ? "bg-amber-100 text-amber-800" :
                                  "bg-red-100 text-red-800"
                                }>
                                  {result.accuracy.toFixed(2)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">{result.correct_answers}</TableCell>
                              <TableCell className="hidden md:table-cell">{result.total_questions}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                {result.processing_time_seconds 
                                  ? `${(result.processing_time_seconds / 60).toFixed(1)} min`
                                  : "N/A"
                                }
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="free-form" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Free-Form Answer Benchmark Results</CardTitle>
                    <CardDescription>
                      Models were evaluated on the quality and accuracy of their free-form explanations about diabetes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableCaption>Results sorted by accuracy (highest first)</TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>Accuracy</TableHead>
                          <TableHead className="hidden md:table-cell">Correct</TableHead>
                          <TableHead className="hidden md:table-cell">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {freeFormResults
                          .sort((a, b) => b.accuracy - a.accuracy)
                          .map((result, index) => (
                            <TableRow key={index} className={index === 0 ? "bg-emerald-50" : ""}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{result.model.split('/')[1]}</span>
                                  <span className="text-xs text-gray-500">{result.model.split('/')[0]}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  result.accuracy > 90 ? "bg-emerald-100 text-emerald-800" :
                                  result.accuracy > 80 ? "bg-blue-100 text-blue-800" :
                                  result.accuracy > 70 ? "bg-amber-100 text-amber-800" :
                                  "bg-red-100 text-red-800"
                                }>
                                  {result.accuracy.toFixed(2)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">{result.correct_answers}</TableCell>
                              <TableCell className="hidden md:table-cell">{result.total_questions}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
