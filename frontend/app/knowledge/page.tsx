'use client';

/**
 * Knowledge Management Page
 * 
 * Provides a user interface for managing the knowledge base used by the RAG system.
 * Features include:
 * - Uploading and processing PDF documents
 * - Viewing and managing existing documents in the knowledge base
 * - Monitoring document processing status
 * - Deleting documents from the knowledge base
 */

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
import { Trash2, FileText, Upload, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import NavigationBar from "@/components/NavigationBar";

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
  const [currentProcessingFilename, setCurrentProcessingFilename] = useState<string | null>(null); // To store the filename used for polling
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  


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
      // console.error removed ('Error fetching processed files:', error);
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
  const pollProcessingStatus = async (filename: string, pollCount = 0) => {
    try {
      // First try the regular processing status endpoint
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rag/processing-status/${filename}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      // console.log removed (`Poll #${pollCount}: Processing status response:`, response.data);
      
      if (response.data.success) {
        const { status, progress, currentStep } = response.data;
        
        // Update the processing status
        setProcessingStatus({
          progress: progress || 0,
          currentStep: currentStep || 'Processing document...'
        });
        
        // Calculate overall progress (30% for upload + 70% for processing)
        const overallProgress = 30 + (progress * 0.7);
        
        if (status === 'completed') {
          // console.log removed ('Processing completed according to status endpoint');
          // Processing completed
          setUploadStatus({
            status: 'success',
            message: 'PDF processed successfully and added to knowledge base',
            progress: 100,
            steps: []
          });
          
          // Reset processing status
          setProcessingStatus(null);
          
          // Refresh the file list
          fetchProcessedFiles();
          
          // Stop polling
          return;
        } else if (status === 'failed') {
          // console.log removed ('Processing failed according to status endpoint');
          // Processing failed
          setUploadStatus({
            status: 'error',
            message: response.data.error || 'Processing failed',
            progress: 0,
            steps: []
          });
          
          // Reset processing status
          setProcessingStatus(null);
          
          // Stop polling
          return;
        } else {
          // Still processing according to status endpoint
          setUploadStatus(prev => ({
            ...prev,
            progress: Math.min(99, overallProgress), // Cap at 99% until complete
            message: currentStep || 'Processing document...'
          }));
          
          // Check if we should use the fallback method
          if (pollCount > 5) { // After 5 polls (10 seconds), start using the fallback as well
            checkFileProcessedFallback(filename, pollCount);
          } else {
            // Continue polling
            setTimeout(() => pollProcessingStatus(filename, pollCount + 1), 2000);
          }
        }
      } else {
        // If response is not successful, try the fallback
        checkFileProcessedFallback(filename, pollCount);
      }
    } catch (error) {
      // console.error removed ('Error polling processing status:', error);
      // Try the fallback method
      checkFileProcessedFallback(filename, pollCount);
    }
  };
  
  // Fallback method to check if file has been processed by checking if the text file exists
  const checkFileProcessedFallback = async (filename: string, pollCount: number) => {
    try {
      // console.log removed (`Using fallback check for ${filename} (poll #${pollCount})`);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rag/check-file-processed/${filename}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      // console.log removed ('Fallback check response:', response.data);
      
      if (response.data.success && response.data.processed) {
        // File has been processed according to the filesystem check
        // console.log removed ('Processing completed according to filesystem check');
        
        setUploadStatus({
          status: 'success',
          message: 'PDF processed successfully and added to knowledge base',
          progress: 100,
          steps: []
        });
        
        // Reset processing status
        setProcessingStatus(null);
        
        // Refresh the file list
        fetchProcessedFiles();
        
        // Stop polling
        return;
      } else {
        // File not processed yet, continue polling
        setTimeout(() => pollProcessingStatus(filename, pollCount + 1), 2000);
      }
    } catch (error) {
      // console.error removed ('Error checking file processed status:', error);
      // Continue polling with the main method
      setTimeout(() => pollProcessingStatus(filename, pollCount + 1), 3000);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploadStatus({
      status: 'uploading',
      message: 'Uploading PDF...',
      progress: 0,
      steps: []
    });

    const formData = new FormData();
    formData.append('pdf', selectedFile);

    try {
      // Upload the file
      setUploadStatus(prev => ({ ...prev, progress: 30 }));
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rag/upload-pdf`,
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
      
      // Start polling for processing status using the filename returned by the backend
      if (response.data.filename) {
        setCurrentProcessingFilename(response.data.filename);
        pollProcessingStatus(response.data.filename);
      } else {
        // Fallback if backend doesn't return filename (should not happen with backend changes)
        console.error('Backend did not return a filename for polling.');
        pollProcessingStatus(selectedFile.name); 
      }

      // Reset file selection
      setSelectedFile(null);
      
      // Reset form
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      // console.error removed ('Error uploading file:', error);
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
        // console.error removed ('Error deleting file:', error);
        alert('Error deleting file');
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleConfirmDeleteAll = async () => {
    if (deleteConfirmText !== 'DELETE ALL') {
      alert('Please type DELETE ALL to confirm.');
      return;
    }
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/rag/delete-all-pdfs`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      fetchProcessedFiles(); // Refresh the list, should be empty
      setShowDeleteAllConfirm(false);
      setDeleteConfirmText('');
      alert('All documents deleted successfully.');
    } catch (error) {
      console.error('Error deleting all documents:', error);
      alert('Failed to delete all documents. Please try again.');
      setShowDeleteAllConfirm(false);
      setDeleteConfirmText('');
    }
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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <NavigationBar />
      
      {/* Main Content */}
      <div className="w-full pt-20 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-4 rounded-lg border border-emerald-100 mb-6 shadow-sm">
            <div className="flex items-start">
              <Database className="h-5 w-5 text-emerald-600 mt-1 mr-3" />
              <div>
                <h3 className="text-emerald-700 font-medium mb-1">Knowledge Base Management</h3>
                <p className="text-gray-600 text-sm">Upload and manage documents that enhance Diabot's ability to provide accurate diabetes information. These documents will be processed and used as context for AI responses.</p>
              </div>
            </div>
          </div>
          
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="mb-6 p-1 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm sticky top-20 z-10">
              <TabsTrigger value="upload" className="flex items-center data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
                <Upload className="w-4 h-4 mr-2" />
                Upload PDF
              </TabsTrigger>
              <TabsTrigger value="manage" className="flex items-center data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
                <Database className="w-4 h-4 mr-2" />
                Manage Documents
              </TabsTrigger>
            </TabsList>

            {/* Delete All Confirmation Dialog */}
            {showDeleteAllConfirm && (
              <AlertDialog open={showDeleteAllConfirm} onOpenChange={(isOpen) => {
                setShowDeleteAllConfirm(isOpen);
                if (!isOpen) setDeleteConfirmText(''); // Clear text if dialog is closed
              }}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all processed documents and their summaries from the server and the vector store.
                      <br /><br />
                      Please type <strong>DELETE ALL</strong> to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input 
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE ALL"
                    className="my-2 border-gray-300 focus:ring-red-500 focus:border-red-500"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleConfirmDeleteAll}
                      disabled={deleteConfirmText !== 'DELETE ALL'}
                      className={deleteConfirmText === 'DELETE ALL' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-300 text-gray-500 cursor-not-allowed"}
                    >
                      Confirm Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            
            <TabsContent value="upload">
              <Card className="border-gray-200 shadow-md bg-white/90 backdrop-blur-md hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl text-gray-800 flex items-center">
                    <span>Upload Diabetes Document</span>
                    <span className="ml-2 bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">PDF Only</span>
                  </CardTitle>
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

                    </div>
                  {selectedFile && (
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg transition-all duration-300 animate-fadeIn shadow-sm hover:shadow-md">
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
                  className="text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Reset
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadStatus.status === 'uploading' || uploadStatus.status === 'processing'}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm hover:shadow"
                >
                  {uploadStatus.status === 'uploading' || uploadStatus.status === 'processing' ? 
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span> : 'Upload Document'}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="manage">
            <Card className="border-gray-200 shadow-md bg-white/90 backdrop-blur-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl text-gray-800">Manage Knowledge Documents</CardTitle>
                    <CardDescription className="text-gray-600">
                      View and manage the documents that have been processed and added to Diabot's knowledge base.
                    </CardDescription>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="flex items-center gap-1"
                    disabled={processedFiles.length === 0}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete All</span>
                  </Button>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                {processedFiles.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-gray-50/50 rounded-lg border border-dashed border-gray-300 animate-fadeIn">
                    <Database className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-gray-500 font-medium mb-2">No documents found</h3>
                    <p className="text-gray-400 text-sm max-w-md mx-auto">
                      Upload a PDF document to add to Diabot's knowledge base and enhance its ability to provide accurate diabetes information.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const uploadTab = document.querySelector('[data-state="inactive"][data-value="upload"]') as HTMLElement;
                        if (uploadTab) uploadTab.click();
                      }}
                      className="mt-4 text-emerald-600 border-emerald-200 hover:bg-emerald-50 transition-colors"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Go to Upload
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {processedFiles.map((file) => (
                      <div 
                        key={file.filename} 
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all duration-300 flex justify-between items-center hover:shadow-md group animate-fadeIn"
                      >
                        <div className="flex items-start space-x-3">
                          <FileText className="h-5 w-5 text-emerald-600 mt-1 group-hover:scale-110 transition-transform" />
                          <div>
                            <h4 className="font-medium text-gray-800">{file.originalName}</h4>
                            <div className="flex mt-1 text-xs text-gray-500 space-x-4">
                              <span>{formatFileSize(file.size)}</span>
                              <span>Uploaded {formatDistanceToNow(new Date(file.created))} ago</span>
                              <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-medium">Active</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(file.filename)}
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors rounded-full opacity-70 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
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
      
      {/* Delete All Knowledge Confirmation Dialog */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-medium text-red-600 mb-2">Delete All Knowledge</h3>
            <p className="text-gray-700 mb-4">
              This will permanently delete all documents from the knowledge base. This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type "delete" to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                placeholder="delete"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteAllConfirm(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirmText !== 'delete'}
                onClick={async () => {
                  try {
                    const response = await axios.delete(
                      `${process.env.NEXT_PUBLIC_API_URL}/api/rag/all-documents`,
                      {
                        headers: {
                          Authorization: `Bearer ${localStorage.getItem('token')}`
                        }
                      }
                    );
                    
                    if (response.data.success) {
                      setProcessedFiles([]);
                      setShowDeleteAllConfirm(false);
                      setDeleteConfirmText('');
                      alert('All knowledge documents have been deleted successfully.');
                    }
                  } catch (error) {
                    // console.error removed ('Error deleting all documents:', error);
                    alert('Failed to delete all documents. Please try again.');
                  }
                }}
              >
                Delete All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
