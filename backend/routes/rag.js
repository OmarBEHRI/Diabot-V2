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
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }
    
  try {
    // Get test mode from query parameter (default: false)
    const testMode = req.query.test === 'true';
    if (testMode) {    }
    
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
            return;
          }
          
          currentStatus.progress = 70;
          currentStatus.currentStep = 'Reinitializing RAG system...';
          processingStatus.set(statusKey, currentStatus);
          
          // Reinitialize RAG system to include new data
          await initRag();
          
          // Mark processing as complete
          const updatedStatus = processingStatus.get(statusKey);
          if (!updatedStatus) {
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
          
        } catch (error) {
        }
      })
      .catch((error) => {
        const currentStatus = processingStatus.get(statusKey);
        if (currentStatus) {
          currentStatus.status = 'failed';
          currentStatus.progress = 0;
          currentStatus.error = error.message;
          currentStatus.currentStep = 'Processing failed';
          processingStatus.set(statusKey, currentStatus);
        }
      });
      
  } catch (error) {
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
    
    res.json({
      success: true,
      files: summaryFiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error getting processed PDFs: ${error.message}`
    });
  }
});

// Route to delete a processed PDF and its summary
router.delete('/processed-pdf/:filename', (req, res) => {
  
  try {
    const SUMMARIES_DIR = path.join(__dirname, '..', '..', 'data', 'summaries');
    const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
    
    const summaryFilename = req.params.filename;
    const summaryPath = path.join(SUMMARIES_DIR, summaryFilename);
    
    // Check if the summary file exists
    if (!fs.existsSync(summaryPath)) {
      return res.status(404).json({
        success: false,
        message: 'Summary file not found'
      });
    }
    
    fs.unlinkSync(summaryPath);
    
    const pdfBasename = summaryFilename.replace('.txt', '');
    const pdfFiles = fs.readdirSync(UPLOADS_DIR)
      .filter(file => file.includes(pdfBasename) && file.endsWith('.pdf'));
    
    if (pdfFiles.length > 0) {
      pdfFiles.forEach(pdfFile => {
        const pdfPath = path.join(UPLOADS_DIR, pdfFile);
        fs.unlinkSync(pdfPath);
      });
    }
    
    initRag();
    
    res.json({
      success: true,
      message: 'PDF and summary deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Error deleting PDF: ${error.message}`
    });
  }
});

// Route to delete all processed PDFs and summaries
router.delete('/delete-all-pdfs', async (req, res) => { // Added async
  console.log('[RAG_ROUTE] Entered /delete-all-pdfs route handler.');
  try {
    const SUMMARIES_DIR = path.join(__dirname, '..', '..', 'data', 'summaries');
    const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads'); // Ensure UPLOADS_DIR is also defined here for clarity

    // Delete all .txt files from summaries directory
    console.log(`[RAG_ROUTE] Checking summaries directory: ${SUMMARIES_DIR}`);
    if (fs.existsSync(SUMMARIES_DIR)) {
      console.log(`[RAG_ROUTE] Reading summaries directory: ${SUMMARIES_DIR}`);
      const summaryFiles = fs.readdirSync(SUMMARIES_DIR).filter(file => file.endsWith('.txt'));
      console.log(`[RAG_ROUTE] Found ${summaryFiles.length} summary files to delete.`);
      summaryFiles.forEach(file => {
        const filePath = path.join(SUMMARIES_DIR, file);
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Error deleting summary file ${filePath}:`, err);
        }
      });
    } else {
      console.log(`SUMMARIES_DIR ${SUMMARIES_DIR} not found, no summaries to delete.`);
    }

    // Delete all .pdf files from uploads directory (using the global UPLOADS_DIR)
    console.log(`[RAG_ROUTE] Checking uploads directory: ${UPLOADS_DIR}`);
    if (fs.existsSync(UPLOADS_DIR)) {
      console.log(`[RAG_ROUTE] Reading uploads directory: ${UPLOADS_DIR}`);
      const pdfFiles = fs.readdirSync(UPLOADS_DIR).filter(file => file.endsWith('.pdf'));
      console.log(`[RAG_ROUTE] Found ${pdfFiles.length} PDF files to delete.`);
      pdfFiles.forEach(file => {
        const filePath = path.join(UPLOADS_DIR, file);
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Error deleting PDF file ${filePath}:`, err);
        }
      });
    } else {
      console.log(`UPLOADS_DIR ${UPLOADS_DIR} not found, no PDFs to delete.`);
    }

    // Reinitialize RAG system (will clear and rebuild an empty vector store)
    console.log('[RAG_ROUTE] /delete-all-pdfs: About to call initRag().');
    await initRag(); // Added await as initRag is async

    res.json({
      success: true,
      message: 'All processed documents and summaries deleted successfully. RAG system reinitialized.'
    });
  } catch (error) {
    console.error('[RAG_ROUTE] CRITICAL ERROR in /delete-all-pdfs:', error);
    res.status(500).json({
      success: false,
      message: `Error deleting all documents: ${error.message}`
    });
  }
});


// Route to get the processing status of a PDF file
router.get('/processing-status/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    
    // First check if we have a completed status (more reliable)
    const completedStatus = completedProcessing.get(filename);
    
    // Then check the regular processing status
    const processingStatusEntry = processingStatus.get(filename);
    
    // Prioritize completed status if available
    const status = completedStatus || processingStatusEntry;
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: `No processing status found for ${filename}`
      });
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
    res.status(500).json({
      success: false,
      message: `Error getting processing status: ${error.message}`
    });
  }
});

// Route to check if a file has been processed by checking if the corresponding text file exists
router.get('/check-file-processed/:filename', (req, res) => {
  
  try {
    const pdfFilename = req.params.filename;
    const baseFilename = pdfFilename.replace('.pdf', '');
    const SUMMARIES_DIR = path.join(__dirname, '..', '..', 'data', 'summaries');
    
    // Check if the corresponding text file exists
    const textFilePath = path.join(SUMMARIES_DIR, `${baseFilename}.txt`);
    const exists = fs.existsSync(textFilePath);
    
    
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
    res.status(500).json({
      success: false,
      message: `Error checking processed file: ${error.message}`
    });
  }
});

export default router;
