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
    console.error('❌ [GET_SOURCES] Error retrieving RAG context:', error);
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
    // Create a unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
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
  console.log('🔵 [PDF UPLOAD] Received request');
  
  if (!req.file) {
    console.log('❌ [PDF UPLOAD] No file uploaded');
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }
  
  console.log(`✅ [PDF UPLOAD] File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);
  
  try {
    // Get test mode from query parameter (default: false)
    const testMode = req.query.test === 'true';
    if (testMode) {
      console.log('⚠️ [PDF UPLOAD] Running in TEST MODE - will only process a few pages');
    }
    
    // Set initial processing status
    const statusKey = req.file.originalname;
    processingStatus.set(statusKey, {
      status: 'processing',
      progress: 0,
      currentStep: 'Starting PDF processing...',
      startTime: Date.now(),
      testMode: testMode,
      filePath: req.file.path,
      fileSize: req.file.size
    });
    
    // Respond immediately with processing started status
    res.json({
      success: true,
      message: 'PDF upload successful, processing started',
      filename: req.file.originalname,
      filesize: req.file.size
    });
    
    // Process the PDF file asynchronously
    console.log(`🔄 [PDF UPLOAD] Starting processing pipeline for ${req.file.path}`);
    
    // Update status to show progress
    processingStatus.get(statusKey).progress = 10;
    processingStatus.get(statusKey).currentStep = 'Extracting text from PDF...';
    
    // Process the PDF file
    processPdfPipeline(req.file.path, testMode)
      .then(async (result) => {
        // Update status to show progress
        processingStatus.get(statusKey).progress = 70;
        processingStatus.get(statusKey).currentStep = 'Reinitializing RAG system...';
        
        // Reinitialize RAG system to include new data
        console.log('🔄 [PDF UPLOAD] Reinitializing RAG system to include new data');
        await initRag();
        
        // Mark processing as complete
        processingStatus.get(statusKey).status = 'completed';
        processingStatus.get(statusKey).progress = 100;
        processingStatus.get(statusKey).currentStep = 'Processing complete';
        processingStatus.get(statusKey).completedAt = Date.now();
        processingStatus.get(statusKey).steps = result.steps;
        
        console.log('✅ [PDF UPLOAD] Processing completed successfully');
      })
      .catch((error) => {
        console.error('❌ [PDF UPLOAD] Error processing PDF:', error);
        processingStatus.get(statusKey).status = 'failed';
        processingStatus.get(statusKey).error = error.message;
      });
      
  } catch (error) {
    console.error('❌ [PDF UPLOAD] Error handling PDF upload:', error);
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
  console.log('🔵 [PROCESSED PDFS] Received request');
  
  try {
    const SUMMARIES_DIR = path.join(__dirname, '..', '..', 'data', 'summaries');
    fs.mkdirSync(SUMMARIES_DIR, { recursive: true });
    
    // Read the summaries directory
    const files = fs.readdirSync(SUMMARIES_DIR);
    
    // Filter for summary files and get their stats
    const summaryFiles = files
      .filter(file => file.endsWith('_summaries.txt'))
      .map(file => {
        const filePath = path.join(SUMMARIES_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          originalName: file.replace('_summaries.txt', '.pdf'),
          size: stats.size,
          created: stats.birthtime,
          lastModified: stats.mtime
        };
      })
      .sort((a, b) => b.lastModified - a.lastModified); // Sort by most recent first
    
    console.log(`✅ [PROCESSED PDFS] Found ${summaryFiles.length} processed PDFs`);
    res.json({
      success: true,
      files: summaryFiles
    });
  } catch (error) {
    console.error('❌ [PROCESSED PDFS] Error getting processed PDFs:', error);
    res.status(500).json({
      success: false,
      message: `Error getting processed PDFs: ${error.message}`
    });
  }
});

// Route to delete a processed PDF and its summary
router.delete('/processed-pdf/:filename', (req, res) => {
  console.log(`🔵 [DELETE PDF] Received request for ${req.params.filename}`);
  
  try {
    const SUMMARIES_DIR = path.join(__dirname, '..', '..', 'data', 'summaries');
    const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
    
    const summaryFilename = req.params.filename;
    const summaryPath = path.join(SUMMARIES_DIR, summaryFilename);
    
    // Check if the summary file exists
    if (!fs.existsSync(summaryPath)) {
      console.log(`❌ [DELETE PDF] Summary file not found: ${summaryPath}`);
      return res.status(404).json({
        success: false,
        message: 'Summary file not found'
      });
    }
    
    // Delete the summary file
    fs.unlinkSync(summaryPath);
    console.log(`✅ [DELETE PDF] Deleted summary file: ${summaryPath}`);
    
    // Try to find and delete the original PDF file (if it exists)
    const pdfBasename = summaryFilename.replace('_summaries.txt', '');
    const pdfFiles = fs.readdirSync(UPLOADS_DIR)
      .filter(file => file.includes(pdfBasename) && file.endsWith('.pdf'));
    
    if (pdfFiles.length > 0) {
      pdfFiles.forEach(pdfFile => {
        const pdfPath = path.join(UPLOADS_DIR, pdfFile);
        fs.unlinkSync(pdfPath);
        console.log(`✅ [DELETE PDF] Deleted original PDF file: ${pdfPath}`);
      });
    }
    
    // Reinitialize RAG system to reflect the changes
    console.log('🔄 [DELETE PDF] Reinitializing RAG system');
    initRag();
    
    res.json({
      success: true,
      message: 'PDF and summary deleted successfully'
    });
  } catch (error) {
    console.error('❌ [DELETE PDF] Error deleting PDF:', error);
    res.status(500).json({
      success: false,
      message: `Error deleting PDF: ${error.message}`
    });
  }
});

// Route to get the processing status of a PDF file
router.get('/processing-status/:filename', (req, res) => {
  console.log(`🔵 [PROCESSING STATUS] Received request for ${req.params.filename}`);
  
  try {
    const filename = req.params.filename;
    
    // Get the status from our tracking system
    const status = processingStatus.get(filename);
    
    if (!status) {
      console.log(`❌ [PROCESSING STATUS] No status found for ${filename}`);
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
    console.error('❌ [PROCESSING STATUS] Error getting processing status:', error);
    res.status(500).json({
      success: false,
      message: `Error getting processing status: ${error.message}`
    });
  }
});

export default router;
