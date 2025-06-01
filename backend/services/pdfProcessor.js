import { PythonShell } from 'python-shell';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to scripts directory
const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');
const SUMMARIES_DIR = path.join(__dirname, '..', '..', 'data', 'summaries');

// Ensure directories exist
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(SUMMARIES_DIR, { recursive: true });

/**
 * Process a PDF file to generate summaries using the process_textbook.py script
 * @param {string} pdfPath - Path to the uploaded PDF file
 * @param {boolean} testMode - Whether to run in test mode (process fewer pages)
 * @returns {Promise<{success: boolean, message: string, outputPath: string}>}
 */
export async function processPdfToSummaries(pdfPath, testMode = false) {
  console.log(`🔄 Processing PDF to summaries: ${pdfPath}`);
  
  // Generate output filename based on the PDF name
  const pdfBasename = path.basename(pdfPath, '.pdf');
  const outputPath = path.join(SUMMARIES_DIR, `${pdfBasename}_summaries.txt`);
  
  return new Promise((resolve, reject) => {
    // Options for Python script
    const options = {
      mode: 'text',
      pythonPath: 'python', // Assumes Python is in PATH
      pythonOptions: ['-u'], // Unbuffered output
      scriptPath: SCRIPTS_DIR,
      args: [
        pdfPath,
        '--output', outputPath,
        ...(testMode ? ['--test'] : []),
      ]
    };
    
    console.log(`🐍 Executing Python script with options:`, JSON.stringify(options, null, 2));
    
    // Run the Python script
    PythonShell.run('process_textbook.py', options)
      .then(messages => {
        console.log('✅ PDF processing completed successfully');
        console.log('📝 Python script output:', messages);
        resolve({
          success: true,
          message: 'PDF processed successfully',
          outputPath: outputPath
        });
      })
      .catch(err => {
        console.error('❌ Error processing PDF:', err);
        reject({
          success: false,
          message: `Error processing PDF: ${err.message}`,
          error: err
        });
      });
  });
}

/**
 * Process summaries file to ChromaDB using process_summaries.py script
 * @param {string} summariesPath - Path to the summaries text file
 * @param {boolean} testMode - Whether to run in test mode
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function processSummariesToChromaDB(summariesPath, testMode = false) {
  console.log(`🔄 Processing summaries to ChromaDB: ${summariesPath}`);
  
  return new Promise((resolve, reject) => {
    // Options for Python script
    const options = {
      mode: 'text',
      pythonPath: 'python', // Assumes Python is in PATH
      pythonOptions: ['-u'], // Unbuffered output
      scriptPath: path.join(SCRIPTS_DIR, 'rag_data_extraction'),
      args: [
        summariesPath,
        ...(testMode ? ['--test'] : []),
      ]
    };
    
    console.log(`🐍 Executing Python script with options:`, JSON.stringify(options, null, 2));
    
    // Run the Python script
    PythonShell.run('process_summaries.py', options)
      .then(messages => {
        console.log('✅ Summaries processing completed successfully');
        console.log('📝 Python script output:', messages);
        resolve({
          success: true,
          message: 'Summaries processed and added to ChromaDB successfully'
        });
      })
      .catch(err => {
        console.error('❌ Error processing summaries:', err);
        reject({
          success: false,
          message: `Error processing summaries: ${err.message}`,
          error: err
        });
      });
  });
}

/**
 * Complete PDF processing pipeline: PDF -> Summaries -> ChromaDB
 * @param {string} pdfPath - Path to the uploaded PDF file
 * @param {boolean} testMode - Whether to run in test mode
 * @returns {Promise<{success: boolean, message: string, steps: Array}>}
 */
export async function processPdfPipeline(pdfPath, testMode = false) {
  console.log(`🚀 Starting PDF processing pipeline for: ${pdfPath}`);
  
  const steps = [];
  
  try {
    // Step 1: Process PDF to summaries
    console.log('📄 Step 1: Processing PDF to summaries...');
    const summariesResult = await processPdfToSummaries(pdfPath, testMode);
    steps.push({
      step: 'pdf_to_summaries',
      success: true,
      message: summariesResult.message
    });
    
    // Step 2: Process summaries to ChromaDB
    console.log('🔍 Step 2: Processing summaries to ChromaDB...');
    const chromaResult = await processSummariesToChromaDB(summariesResult.outputPath, testMode);
    steps.push({
      step: 'summaries_to_chroma',
      success: true,
      message: chromaResult.message
    });
    
    return {
      success: true,
      message: 'PDF processing pipeline completed successfully',
      steps: steps
    };
  } catch (error) {
    console.error('❌ Error in PDF processing pipeline:', error);
    steps.push({
      step: error.step || 'unknown',
      success: false,
      message: error.message || 'Unknown error'
    });
    
    return {
      success: false,
      message: `PDF processing pipeline failed: ${error.message}`,
      steps: steps
    };
  }
}
