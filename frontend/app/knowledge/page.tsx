'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Trash2, FileText, Upload, Database, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ProcessedFile {
  filename: string;
  originalName: string;
  size: number;
  created: string;
  lastModified: string;
}

interface UploadStatus {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  message: string;
  progress: number;
  steps: {
    step: string;
    success: boolean;
    message: string;
  }[];
}

export default function KnowledgePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: 'idle',
    message: '',
    progress: 0,
    steps: []
  });
  const [processingStatus, setProcessingStatus] = useState<{progress: number, currentStep: string} | null>(null);
  const [testMode, setTestMode] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Fetch processed files on component mount
  useEffect(() => {
    if (user) {
      fetchProcessedFiles();
    }
  }, [user]);

  const fetchProcessedFiles = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/rag/processed-pdfs`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data.success) {
        setProcessedFiles(response.data.files);
      }
    } catch (error) {
      console.error('Error fetching processed files:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        alert('Please select a PDF file');
      }
    }
  };

  // Function to poll for processing status
  const pollProcessingStatus = async (filename: string) => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rag/processing-status/${filename}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (response.data.success) {
        const { status, progress, currentStep } = response.data;
        
        // Update the processing status
        setProcessingStatus({
          progress: progress || 0,
          currentStep: currentStep || 'Processing document...'
        });
        
        // Calculate overall progress (30% for upload + 70% for processing)
        const overallProgress = 30 + (progress * 0.7);
        
        setUploadStatus(prev => ({
          ...prev,
          progress: Math.min(99, overallProgress), // Cap at 99% until complete
          message: currentStep || 'Processing document...'
        }));
        
        // Continue polling if still processing
        if (status === 'processing') {
          setTimeout(() => pollProcessingStatus(filename), 2000);
        } else if (status === 'completed') {
          // Processing completed
          setUploadStatus(prev => ({
            ...prev,
            status: 'success',
            message: 'PDF processed successfully and added to knowledge base',
            progress: 100
          }));
          
          // Reset processing status
          setProcessingStatus(null);
          
          // Refresh the file list
          fetchProcessedFiles();
        }
      }
    } catch (error) {
      console.error('Error polling processing status:', error);
      // Continue polling even if there's an error
      setTimeout(() => pollProcessingStatus(filename), 3000);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    setUploadStatus({
      status: 'uploading',
      message: 'Uploading PDF file...',
      progress: 10,
      steps: []
    });

    const formData = new FormData();
    formData.append('pdf', selectedFile);

    try {
      // Upload the file
      setUploadStatus(prev => ({ ...prev, progress: 30 }));
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rag/upload-pdf${testMode ? '?test=true' : ''}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 20) / progressEvent.total!);
            setUploadStatus(prev => ({ 
              ...prev, 
              progress: 10 + percentCompleted // 10-30% for upload
            }));
          }
        }
      );

      // Processing phase
      setUploadStatus(prev => ({ 
        ...prev, 
        status: 'processing',
        message: 'Processing PDF and generating summaries...',
        progress: 50
      }));
      
      // Start polling for processing status if we have a filename
      if (response.data.filename) {
        pollProcessingStatus(response.data.uploadedFilename || response.data.filename);
      } else {
        // If no filename, just show success
        setUploadStatus({
          status: 'success',
          message: response.data.message,
          progress: 100,
          steps: response.data.steps || []
        });
      }

      // Reset file selection
      setSelectedFile(null);
      
      // Reset form
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      setUploadStatus({
        status: 'error',
        message: error.response?.data?.message || 'Error uploading file',
        progress: 0,
        steps: []
      });
      setProcessingStatus(null);
    }
  };

  const handleDelete = async (filename: string) => {
    if (window.confirm(`Are you sure you want to delete ${filename}?`)) {
      try {
        await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/rag/processed-pdf/${filename}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        // Refresh the list
        fetchProcessedFiles();
      } catch (error) {
        console.error('Error deleting file:', error);
        alert('Error deleting file');
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-emerald-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-teal-50">
      {/* Header with glass effect */}
      <header className="sticky top-0 backdrop-blur-md bg-white/80 border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <img 
            src="/Diabot-Logo.png" 
            alt="Diabot Logo" 
            className="h-9 w-9 drop-shadow-md" 
          />
          <h1 className="text-xl font-semibold">
            <span className="bg-gradient-to-r from-[#4EC3BE] to-[#47C06F] bg-clip-text text-transparent">Diabot</span>
            <span className="ml-2 text-gray-700">Knowledge Base</span>
          </h1>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.push('/chat')}
          className="flex items-center space-x-2 hover:bg-emerald-50 text-emerald-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Chat</span>
        </Button>
      </header>
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Knowledge Management</h2>
          <p className="text-gray-600">Upload and manage documents that enhance Diabot's ability to provide accurate diabetes information.</p>
        </div>
      
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="mb-6 p-1 bg-white/50 backdrop-blur-sm border border-gray-200 rounded-lg">
            <TabsTrigger value="upload" className="flex items-center data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Upload className="w-4 h-4 mr-2" />
              Upload PDF
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Database className="w-4 h-4 mr-2" />
              Manage Documents
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <Card className="border-gray-200 shadow-lg bg-white/90 backdrop-blur-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-gray-800">Upload Diabetes Document</CardTitle>
                <CardDescription className="text-gray-600">
                  Upload a PDF document to add to Diabot's knowledge base. The document will be processed
                  and used to provide context for diabetes-related questions.
                </CardDescription>
              </CardHeader>
              <Separator className="mb-6" />
              <CardContent>
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <label htmlFor="pdf-upload" className="block text-sm font-medium text-gray-700 mb-2">
                        Select PDF Document
                      </label>
                      <Input
                        id="pdf-upload"
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        disabled={uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'}
                        className="flex-1 border-gray-300 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                      <Switch
                        id="test-mode"
                        checked={testMode}
                        onCheckedChange={setTestMode}
                      />
                      <Label htmlFor="test-mode" className="text-sm font-medium text-gray-600">Test Mode</Label>
                    </div>
                  </div>
                  
                  {selectedFile && (
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg transition-all duration-300 animate-fadeIn">
                      <p className="text-sm font-medium text-emerald-800">Selected file:</p>
                      <div className="flex items-center mt-1">
                        <FileText className="w-5 h-5 mr-2 text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">{selectedFile.name}</span>
                        <span className="text-xs text-emerald-600 ml-2">({formatFileSize(selectedFile.size)})</span>
                      </div>
                    </div>
                  )}
                  
                  {(uploadStatus.status === 'uploading' || uploadStatus.status === 'processing') && (
                    <div className="space-y-3 bg-blue-50 p-5 rounded-lg border border-blue-100 animate-pulse">
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                        <p className="text-sm font-medium text-blue-800">{uploadStatus.message}</p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-blue-700 font-medium">
                          <span>{processingStatus?.currentStep || 'Processing...'}</span>
                          <span>{Math.round(uploadStatus.progress)}%</span>
                        </div>
                        <Progress value={uploadStatus.progress} className="h-2.5 bg-blue-100" />
                      </div>
                      
                      {processingStatus && (
                        <div className="text-xs text-blue-600 italic bg-blue-100/50 p-2 rounded">
                          This may take a few minutes depending on the document size.
                        </div>
                      )}
                    </div>
                  )}
                  
                  {uploadStatus.status === 'success' && (
                    <Alert className="bg-emerald-50 border-emerald-200 text-emerald-800">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <AlertTitle className="text-emerald-800 font-medium">Success!</AlertTitle>
                      <AlertDescription className="text-emerald-700">
                        {uploadStatus.message}
                      </AlertDescription>
                      
                      {uploadStatus.steps && uploadStatus.steps.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {uploadStatus.steps.map((step, index) => (
                            <div key={index} className="flex items-start text-xs">
                              <div className={`mt-0.5 mr-1.5 ${step.success ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {step.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                              </div>
                              <span className={step.success ? 'text-emerald-700' : 'text-amber-700'}>
                                {step.message || step.step}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Alert>
                  )}
                  
                  {uploadStatus.status === 'error' && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-5 w-5" />
                      <AlertTitle>Upload Failed</AlertTitle>
                      <AlertDescription>
                        {uploadStatus.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null);
                    setUploadStatus({
                      status: 'idle',
                      message: '',
                      progress: 0,
                      steps: []
                    });
                    // Reset file input
                    const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
                    if (fileInput) fileInput.value = '';
                  }}
                  disabled={uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'}
                  className="text-gray-600"
                >
                  Reset
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {uploadStatus.status === 'uploading' || uploadStatus.status === 'processing' ? 
                    'Processing...' : 'Upload Document'}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="manage">
            <Card className="border-gray-200 shadow-lg bg-white/90 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-xl text-gray-800">Manage Knowledge Documents</CardTitle>
                <CardDescription className="text-gray-600">
                  View and manage the documents that have been processed and added to Diabot's knowledge base.
                </CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                {processedFiles.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-gray-500 font-medium mb-1">No documents found</h3>
                    <p className="text-gray-400 text-sm">
                      Upload a PDF document to add to Diabot's knowledge base.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {processedFiles.map((file) => (
                      <div 
                        key={file.filename} 
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex justify-between items-center"
                      >
                        <div className="flex items-start space-x-3">
                          <FileText className="h-5 w-5 text-emerald-600 mt-1" />
                          <div>
                            <h4 className="font-medium text-gray-800">{file.originalName}</h4>
                            <div className="flex mt-1 text-xs text-gray-500 space-x-4">
                              <span>{formatFileSize(file.size)}</span>
                              <span>Uploaded {formatDistanceToNow(new Date(file.created))} ago</span>
                              <span className="text-emerald-600">Active</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(file.filename)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    )  
}
