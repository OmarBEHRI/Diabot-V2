/**
 * RAG (Retrieval-Augmented Generation) API Routes
 * 
 * Handles all knowledge base management endpoints including:
 * - PDF document upload and processing
 * - Document listing and deletion
 * - Processing status tracking
 * - RAG context retrieval for chat messages
 * - Source document management and full-text retrieval
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authMiddleware from '../middleware/auth.js';
import { processPdfPipeline } from '../services/pdfProcessor.js';
import { initRag } from '../services/rag.js';

// In-memory store for processing status
// In a production environment, this should be in a database or Redis
const processingStatus = new Map();

// Keep track of completed processing tasks to ensure frontend gets notified
const completedProcessing = new Map();

// Function to clean up old completed tasks (after 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of completedProcessing.entries()) {
    if (now - value.completedAt > 10 * 60 * 1000) { // 10 minutes
      completedProcessing.delete(key);
      // console.log removed (`🧹 [CLEANUP] Removed completed status for ${key}`);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Protect all RAG routes with authentication
router.use(authMiddleware);

// Get RAG context and sources for a query (for benchmarking, no session)
router.post('/get_sources', async (req, res) => {
  try {
    const { question, n_results, include_adjacent } = req.body;
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Missing or invalid question in request body' });
    }
    // Default values
    const topN = typeof n_results === 'number' ? n_results : 3;
    const adjacent = typeof include_adjacent === 'boolean' ? include_adjacent : false;
    // Import retrieveRelevantContext lazily to avoid circular deps
    const { retrieveRelevantContext } = await import('../services/rag.js');
    const { context, sources } = await retrieveRelevantContext(question, topN, adjacent);
    res.json({ context, sources });
  } catch (error) {
    // console.error removed ('❌ [GET_SOURCES] Error retrieving RAG context:', error);
    res.status(500).json({ error: 'Server error retrieving RAG context' });
  }
});

// Configure multer for file uploads
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Sanitize the original filename to remove characters that might be problematic
    // and truncate if it's too long.
    const sanitizedOriginalName = file.originalname
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_') // Replace invalid chars with underscore
      .substring(0, 100); // Limit length to prevent overly long filenames

    const timestamp = Date.now();
    const originalExt = path.extname(file.originalname);
    // Remove original extension from sanitizedOriginalName if it's there, to avoid duplication
    const sanitizedBaseName = sanitizedOriginalName.endsWith(originalExt) 
      ? sanitizedOriginalName.substring(0, sanitizedOriginalName.length - originalExt.length)
      : sanitizedOriginalName;

    // Append timestamp to the sanitized original base name for uniqueness and readability
    cb(null, `${sanitizedBaseName}-${timestamp}${originalExt}`);
  }
});

// File filter to only accept PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// Create the multer upload instance
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Route to upload and process a PDF file
router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  // console.log removed ('🔵 [PDF UPLOAD] Received request');
  
  if (!req.file) {
    // console.log removed ('❌ [PDF UPLOAD] No file uploaded');
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }
  
  // console.log removed (`✅ [PDF UPLOAD] File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);
  
  try {
    // Get test mode from query parameter (default: false)
    const testMode = req.query.test === 'true';
    if (testMode) {
      // console.log removed ('⚠️ [PDF UPLOAD] Running in TEST MODE - will only process a few pages');
    }
    
    // Set initial processing status using the actual filename saved by multer
    const statusKey = req.file.filename; // Use the generated filename as the key
    processingStatus.set(statusKey, {
      status: 'processing',
      progress: 0,
      currentStep: 'Starting PDF processing...',
      startTime: Date.now(),
      testMode: testMode,
      filePath: req.file.path,
      fileSize: req.file.size,
      originalName: req.file.originalname // Store original name for reference if needed
    });
    
    // Respond immediately with processing started status
    // IMPORTANT: Return the generated filename (statusKey) so frontend can poll with it
    res.json({
      success: true,
      message: 'PDF upload successful, processing started',
      filename: statusKey, // This is the key to use for polling
      originalName: req.file.originalname,
      filesize: req.file.size
    });
    
    // Process the PDF file asynchronously
    // console.log removed (`🔄 [PDF UPLOAD] Starting processing pipeline for ${req.file.path}`);
    
    // Update status to show progress
    processingStatus.get(statusKey).progress = 10;
    processingStatus.get(statusKey).currentStep = 'Extracting text from PDF...';
    
    // Process the PDF file
    processPdfPipeline(req.file.path, testMode)
      .then(async (result) => {
        try {
          // Update status to show progress
          const currentStatus = processingStatus.get(statusKey);
          if (!currentStatus) {
            // console.warn removed (`⚠️ [PDF UPLOAD] Status not found for ${statusKey} when trying to update progress`);
            return;
          }
          
          currentStatus.progress = 70;
          currentStatus.currentStep = 'Reinitializing RAG system...';
          processingStatus.set(statusKey, currentStatus);
          
          // Reinitialize RAG system to include new data
          // console.log removed ('🔄 [PDF UPLOAD] Reinitializing RAG system to include new data');
          await initRag();
          
          // Mark processing as complete
          const updatedStatus = processingStatus.get(statusKey);
          if (!updatedStatus) {
            // console.warn removed (`⚠️ [PDF UPLOAD] Status not found for ${statusKey} when trying to mark as complete`);
            return;
          }
          
          updatedStatus.status = 'completed';
          updatedStatus.progress = 100;
          updatedStatus.currentStep = 'Processing complete';
          updatedStatus.completedAt = Date.now();
          updatedStatus.steps = result.steps;
          processingStatus.set(statusKey, updatedStatus);
          
          // Also store in completedProcessing for reliable status checks
          completedProcessing.set(statusKey, {
            status: 'completed',
            progress: 100,
            completedAt: Date.now()
          });
          
          // console.log removed ('✅ [PDF UPLOAD] Processing completed successfully');
          // console.log removed ('📊 [PDF UPLOAD] Final status:', JSON.stringify(processingStatus.get(statusKey)));
        } catch (error) {
          // console.error removed ('❌ [PDF UPLOAD] Error updating processing status:', error);
        }
      })
      .catch((error) => {
        // console.error removed ('❌ [PDF UPLOAD] Error processing PDF:', error);
        const currentStatus = processingStatus.get(statusKey);
        if (currentStatus) {
          currentStatus.status = 'failed';
          currentStatus.progress = 0;
          currentStatus.error = error.message;
          currentStatus.currentStep = 'Processing failed';
          processingStatus.set(statusKey, currentStatus);
          // console.log removed ('📊 [PDF UPLOAD] Error status set:', JSON.stringify(processingStatus.get(statusKey)));
        }
      });
      
  } catch (error) {
    // console.error removed ('❌ [PDF UPLOAD] Error handling PDF upload:', error);
    res.status(500).json({
      success: false,
      message: `Error handling PDF upload: ${error.message}`,
      filename: req.file.originalname,
      filesize: req.file.size
    });
  }
});

// Route to get a list of all processed PDFs
router.get('/processed-pdfs', (req, res) => {
  // console.log removed ('🔵 [PROCESSED PDFS] Received request');
  
  try {
    const SUMMARIES_DIR = path.join(__dirname, '..', '..', 'data', 'summaries');
    fs.mkdirSync(SUMMARIES_DIR, { recursive: true });
    
    // Read the summaries directory
    const files = fs.readdirSync(SUMMARIES_DIR);
    
    // Filter for text files and get their stats
    const summaryFiles = files
      .filter(file => file.endsWith('.txt'))
      .map(file => {
        const filePath = path.join(SUMMARIES_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          originalName: file.replace('.txt', '.pdf'),
          size: stats.size,
          created: stats.birthtime,
          lastModified: stats.mtime
        };
      })
      .sort((a, b) => b.lastModified - a.lastModified); // Sort by most recent first
    
    // console.log removed (`✅ [PROCESSED PDFS] Found ${summaryFiles.length} processed PDFs`);
    res.json({
      success: true,
      files: summaryFiles
    });
  } catch (error) {
    // console.error removed ('❌ [PROCESSED PDFS] Error getting processed PDFs:', error);
    res.status(500).json({
      success: false,
      message: `Error getting processed PDFs: ${error.message}`
    });
  }
});

// Route to delete a processed PDF and its summary
router.delete('/processed-pdf/:filename', (req, res) => {
  // console.log removed (`🔵 [DELETE PDF] Received request for ${req.params.filename}`);
  
  try {
    const SUMMARIES_DIR = path.join(__dirname, '..', '..', 'data', 'summaries');
    const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
    
    const summaryFilename = req.params.filename;
    const summaryPath = path.join(SUMMARIES_DIR, summaryFilename);
    
    // Check if the summary file exists
    if (!fs.existsSync(summaryPath)) {
      // console.log removed (`❌ [DELETE PDF] Summary file not found: ${summaryPath}`);
      return res.status(404).json({
        success: false,
        message: 'Summary file not found'
      });
    }
    
    // Delete the summary file
    fs.unlinkSync(summaryPath);
    // console.log removed (`✅ [DELETE PDF] Deleted summary file: ${summaryPath}`);
    
    // Try to find and delete the original PDF file (if it exists)
    const pdfBasename = summaryFilename.replace('.txt', '');
    const pdfFiles = fs.readdirSync(UPLOADS_DIR)
      .filter(file => file.includes(pdfBasename) && file.endsWith('.pdf'));
    
    if (pdfFiles.length > 0) {
      pdfFiles.forEach(pdfFile => {
        const pdfPath = path.join(UPLOADS_DIR, pdfFile);
        fs.unlinkSync(pdfPath);
        // console.log removed (`✅ [DELETE PDF] Deleted original PDF file: ${pdfPath}`);
      });
    }
    
    // Reinitialize RAG system to reflect the changes
    // console.log removed ('🔄 [DELETE PDF] Reinitializing RAG system');
    initRag();
    
    res.json({
      success: true,
      message: 'PDF and summary deleted successfully'
    });
  } catch (error) {
    // console.error removed ('❌ [DELETE PDF] Error deleting PDF:', error);
    res.status(500).json({
      success: false,
      message: `Error deleting PDF: ${error.message}`
    });
  }
});

// Route to get the processing status of a PDF file
router.get('/processing-status/:filename', (req, res) => {
  // console.log removed (`🔵 [PROCESSING STATUS] Received request for ${req.params.filename}`);
  // console.log removed (`🔍 [PROCESSING STATUS] Current status map has ${processingStatus.size} entries`);
  
  // Debug: List all keys in the processingStatus map
  // console.log removed ('🔑 [PROCESSING STATUS] All status keys:', Array.from(processingStatus.keys()));
  
  try {
    const filename = req.params.filename;
    
    // First check if we have a completed status (more reliable)
    const completedStatus = completedProcessing.get(filename);
    
    // Then check the regular processing status
    const processingStatusEntry = processingStatus.get(filename);
    
    // Prioritize completed status if available
    const status = completedStatus || processingStatusEntry;
    
    if (!status) {
      // console.log removed (`❌ [PROCESSING STATUS] No status found for ${filename}`);
      return res.status(404).json({
        success: false,
        message: `No processing status found for ${filename}`
      });
    }
    
    // Log which map we found the status in
    if (completedStatus) {
      // console.log removed (`✅ [PROCESSING STATUS] Found COMPLETED status for ${filename}:`, JSON.stringify(status));
    } else {
      // console.log removed (`✅ [PROCESSING STATUS] Found PROCESSING status for ${filename}:`, JSON.stringify(status));
    }
    
    // If the processing is in test mode, simulate a delay for better UX
    if (status.testMode && status.status === 'processing') {
      const elapsedTime = Date.now() - status.startTime;
      
      // For test mode, simulate progress over time (complete in ~15 seconds)
      if (elapsedTime < 15000) {
        // Calculate progress based on elapsed time
        const calculatedProgress = Math.min(95, Math.floor((elapsedTime / 15000) * 100));
        
        // Update progress if it's higher than current progress
        if (calculatedProgress > status.progress) {
          status.progress = calculatedProgress;
          
          // Update step description based on progress
          if (calculatedProgress < 30) {
            status.currentStep = 'Extracting text from PDF...';
          } else if (calculatedProgress < 60) {
            status.currentStep = 'Generating summaries...';
          } else if (calculatedProgress < 90) {
            status.currentStep = 'Preparing data for RAG system...';
          } else {
            status.currentStep = 'Finalizing processing...';
          }
        }
      } else {
        // After 15 seconds, mark as complete
        status.status = 'completed';
        status.progress = 100;
        status.currentStep = 'Processing complete';
        status.completedAt = Date.now();
      }
    }
    
    res.json({
      success: true,
      status: status.status,
      progress: status.progress,
      currentStep: status.currentStep,
      error: status.error || null
    });
  } catch (error) {
    // console.error removed ('❌ [PROCESSING STATUS] Error getting processing status:', error);
    res.status(500).json({
      success: false,
      message: `Error getting processing status: ${error.message}`
    });
  }
});

// Route to check if a file has been processed by checking if the corresponding text file exists
router.get('/check-file-processed/:filename', (req, res) => {
  // console.log removed (`🔵 [CHECK PROCESSED] Received request for ${req.params.filename}`);
  
  try {
    const pdfFilename = req.params.filename;
    const baseFilename = pdfFilename.replace('.pdf', '');
    const SUMMARIES_DIR = path.join(__dirname, '..', '..', 'data', 'summaries');
    
    // Check if the corresponding text file exists
    const textFilePath = path.join(SUMMARIES_DIR, `${baseFilename}.txt`);
    const exists = fs.existsSync(textFilePath);
    
    // console.log removed (`🔍 [CHECK PROCESSED] Checking if ${textFilePath} exists: ${exists}`);
    
    if (exists) {
      // Get file stats
      const stats = fs.statSync(textFilePath);
      
      res.json({
        success: true,
        processed: true,
        filename: pdfFilename,
        textFile: `${baseFilename}.txt`,
        size: stats.size,
        created: stats.birthtime,
        lastModified: stats.mtime
      });
    } else {
      res.json({
        success: true,
        processed: false,
        filename: pdfFilename
      });
    }
  } catch (error) {
    // console.error removed ('❌ [CHECK PROCESSED] Error checking processed file:', error);
    res.status(500).json({
      success: false,
      message: `Error checking processed file: ${error.message}`
    });
  }
});

export default router;
