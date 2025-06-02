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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Define benchmark result types
interface ModelResult {
  model: string;
  timestamp: string;
  accuracy: number;
  total_questions: number;
  correct_answers: number;
  processing_time_seconds?: number;
}

interface ChartData {
  name: string;
  rag: number;
  noRag: number;
}

// Helper function to determine badge color based on accuracy
function getBadgeVariant(accuracy: number): "default" | "secondary" | "destructive" | "outline" {
  if (accuracy >= 95) return "default" // Using default for highest accuracy
  if (accuracy >= 80) return "secondary"
  if (accuracy >= 70) return "outline"
  return "destructive"
}

// Generate data for the chart
function generateChartData(mcResults: ModelResult[], ffResults: ModelResult[]): ChartData[] {
  // Create a mapping of model names to their RAG and non-RAG accuracies
  const modelData: ChartData[] = [];
  
  // For demonstration, we'll use the multiple choice results as RAG
  // and free-form results as non-RAG
  mcResults.forEach((mcResult: ModelResult) => {
    // Find matching free-form result
    const ffResult = ffResults.find((ff: ModelResult) => {
      return ff.model.includes(mcResult.model.split('/').pop() || '') || 
             mcResult.model.includes(ff.model.split('/').pop() || '');
    });
    
    if (ffResult) {
      modelData.push({
        name: mcResult.model.split('/').pop() || mcResult.model,
        rag: mcResult.accuracy,
        noRag: ffResult.accuracy
      });
    } else {
      modelData.push({
        name: mcResult.model.split('/').pop() || mcResult.model,
        rag: mcResult.accuracy,
        noRag: 0
      });
    }
  });
  
  return modelData;
}

// Generate data for the free-form chart
function generateFreeFormChartData(ffResults: ModelResult[], mcResults: ModelResult[]): ChartData[] {
  // Similar to above but with different data arrangement
  const modelData: ChartData[] = [];
  
  ffResults.forEach((ffResult: ModelResult) => {
    // Find matching multiple-choice result
    const mcResult = mcResults.find((mc: ModelResult) => {
      return mc.model.includes(ffResult.model.split('/').pop() || '') || 
             ffResult.model.includes(mc.model.split('/').pop() || '');
    });
    
    if (mcResult) {
      modelData.push({
        name: ffResult.model.split('/').pop() || ffResult.model,
        rag: mcResult.accuracy,
        noRag: ffResult.accuracy
      });
    } else {
      modelData.push({
        name: ffResult.model.split('/').pop() || ffResult.model,
        rag: 0,
        noRag: ffResult.accuracy
      });
    }
  });
  
  return modelData;
}

export default function BenchmarksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("multiple-choice");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [chartView, setChartView] = useState("table"); // "table" or "chart"
  
  // Dynamic benchmark data
  const [multipleChoiceResults, setMultipleChoiceResults] = useState<ModelResult[]>([]);
  const [freeFormNoRagResults, setFreeFormNoRagResults] = useState<ModelResult[]>([]);
  const [freeFormWithRagResults, setFreeFormWithRagResults] = useState<ModelResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      try {
        const mcRes = await fetch('/benchmarking/first-method-model-results-summary.json');
        if (!mcRes.ok) throw new Error('Multiple Choice results not found');
        const mcData = await mcRes.json();
        setMultipleChoiceResults(mcData.map((item: any) => ({
          model: item.model,
          accuracy: typeof item.accuracy === 'number' ? item.accuracy : Number(item.accuracy),
          timestamp: '',
          total_questions: 157,
          correct_answers: Math.round((typeof item.accuracy === 'number' ? item.accuracy : Number(item.accuracy)) * 1.57),
        })));

        const ffNoRagRes = await fetch('/benchmarking/second-method-model-no-rag-results.json');
        if (!ffNoRagRes.ok) throw new Error('Free-Form No RAG results not found');
        const ffNoRagData = await ffNoRagRes.json();
        setFreeFormNoRagResults(ffNoRagData.map((item: any) => ({
          model: item.model,
          accuracy: typeof item.accuracy === 'number' ? item.accuracy : Number(item.accuracy),
          timestamp: '',
          total_questions: 157,
          correct_answers: Math.round((typeof item.accuracy === 'number' ? item.accuracy : Number(item.accuracy)) * 1.57),
        })));

        const ffWithRagRes = await fetch('/benchmarking/second-method-model-with-rag-results.json');
        if (!ffWithRagRes.ok) throw new Error('Free-Form With RAG results not found');
        const ffWithRagData = await ffWithRagRes.json();
        setFreeFormWithRagResults(ffWithRagData.map((item: any) => ({
          model: item.model,
          accuracy: typeof item.accuracy === 'number' ? item.accuracy : Number(item.accuracy),
          timestamp: '',
          total_questions: 157,
          correct_answers: Math.round((typeof item.accuracy === 'number' ? item.accuracy : Number(item.accuracy)) * 1.57),
        })));
      } catch (e) {
        setMultipleChoiceResults([]);
        setFreeFormNoRagResults([]);
        setFreeFormWithRagResults([]);
        setError((e as Error).message);
      }
      setLoading(false);
    }
    fetchResults();
  }, []);

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
                  <br/>
                  <strong>Multiple Choice:</strong> Evaluates accuracy on 157 questions with defined answers.
                  <br/>
                  <strong>Free-Form:</strong> Assesses the quality of generated explanations on similar topics, with and without retrieval-augmented generation (RAG) context.
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
                    {loading ? (
                      <div>Loading...</div>
                    ) : error ? (
                      <div className="text-red-500">{error}</div>
                    ) : multipleChoiceResults.length === 0 ? (
                      <div>No multiple choice results found.</div>
                    ) : (
                      <>
                        {/* Chart/Table Toggle */}
                        <div className="flex justify-end mb-2">
                          <Button
                            variant={chartView === "table" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setChartView("table")}
                            className="mr-2"
                          >
                            Table
                          </Button>
                          <Button
                            variant={chartView === "chart" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setChartView("chart")}
                          >
                            Chart
                          </Button>
                        </div>
                        {chartView === "table" ? (
                          <Table>
                            <TableCaption>Benchmark results (no RAG, one accuracy per model)</TableCaption>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Model</TableHead>
                                <TableHead className="text-right">Accuracy</TableHead>
                                <TableHead className="text-right">Correct / Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {multipleChoiceResults.map((result, index) => (
                                <TableRow key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                                  <TableCell className="font-medium">{result.model}</TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant={getBadgeVariant(result.accuracy)} className="font-mono">
                                      {result.accuracy.toFixed(2)}%
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">{result.correct_answers} / {result.total_questions}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="w-full h-96">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={generateChartData(multipleChoiceResults, freeFormNoRagResults)}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis domain={[0, 100]} label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }} />
                                <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Accuracy']} />
                                <Legend />
                                <Bar dataKey="rag" name="Accuracy" fill="#10b981" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="free-form" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Free-Form Answer Benchmark Results</CardTitle>
                    <CardDescription>
                      Models were evaluated on the quality and accuracy of their free-form explanations about diabetes, both with and without retrieval-augmented context (RAG).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div>Loading...</div>
                    ) : error ? (
                      <div className="text-red-500">{error}</div>
                    ) : (freeFormNoRagResults.length === 0 && freeFormWithRagResults.length === 0) ? (
                      <div>No free-form results found.</div>
                    ) : (
                      <>
                        {/* Chart/Table Toggle */}
                        <div className="flex justify-end mb-2">
                          <Button
                            variant={chartView === "table" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setChartView("table")}
                            className="mr-2"
                          >
                            Table
                          </Button>
                          <Button
                            variant={chartView === "chart" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setChartView("chart")}
                          >
                            Chart
                          </Button>
                        </div>

                        {chartView === "table" ? (
                          <>
                            <h4 className="font-semibold mb-2">No RAG</h4>
                            <Table className="mb-6">
                              <TableCaption>Free-Form Answer Benchmark Results (No RAG) - sorted by accuracy</TableCaption>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Model</TableHead>
                                  <TableHead>Accuracy</TableHead>
                                  <TableHead className="hidden md:table-cell">Correct</TableHead>
                                  <TableHead className="hidden md:table-cell">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {freeFormNoRagResults
                                  .sort((a, b) => b.accuracy - a.accuracy)
                                  .map((result, index) => (
                                    <TableRow key={index} className={index === 0 ? "bg-emerald-50" : ""}>
                                      <TableCell className="font-medium">{result.model}</TableCell>
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
                            <h4 className="font-semibold mb-2">With RAG</h4>
                            <Table>
                              <TableCaption>Free-Form Answer Benchmark Results (With RAG) - sorted by accuracy</TableCaption>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Model</TableHead>
                                  <TableHead>Accuracy</TableHead>
                                  <TableHead className="hidden md:table-cell">Correct</TableHead>
                                  <TableHead className="hidden md:table-cell">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {freeFormWithRagResults
                                  .sort((a, b) => b.accuracy - a.accuracy)
                                  .map((result, index) => (
                                    <TableRow key={index} className={index === 0 ? "bg-emerald-50" : ""}>
                                      <TableCell className="font-medium">{result.model}</TableCell>
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
                          </>
                        ) : (
                          <div className="w-full h-96">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart 
                                data={generateFreeFormChartData(freeFormNoRagResults, freeFormWithRagResults)}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis domain={[0, 100]} label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft' }} />
                                <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Accuracy']} />
                                <Legend />
                                <Bar dataKey="rag" name="With RAG" fill="#10b981" />
                                <Bar dataKey="noRag" name="Without RAG" fill="#6366f1" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </> 
                    )}
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
