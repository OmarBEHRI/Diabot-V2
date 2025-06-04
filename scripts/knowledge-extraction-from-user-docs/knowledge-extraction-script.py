"""PDF Processing Script for Diabot RAG System

This script processes diabetes textbooks and medical PDFs for the Diabot knowledge base:
- Extracts text from PDF documents using PyMuPDF
- Generates concise summaries using LLaMA 3.3 70B via OpenRouter API
- Processes documents page by page with checkpointing for resumable operations
- Supports test mode for faster processing of sample pages
- Outputs structured summaries for ingestion into the ChromaDB vector database
- Used by the backend pdfProcessor.js service through PythonShell integration
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import fitz  # PyMuPDF
import requests
from typing import List, Optional
import time
import json
import argparse
import pickle
from datetime import datetime, timedelta

# Always load .env from the script's directory
dotenv_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path)

# Optional: Warn if API key is missing
def _warn_missing_api_key():
    if not os.getenv("OPENROUTER_API_KEY"):
        print("Warning: OPENROUTER_API_KEY not found in environment after loading .env")
_warn_missing_api_key()

# Constants
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
MODEL_NAME = "meta-llama/llama-3.3-70b-instruct"
REQUEST_DELAY = 1  # seconds between API calls
SKIP_KEYWORD = "[SKIP]"
CHECKPOINT_FILE = "textbook_processing_checkpoint.pkl"
OUTPUT_FILE = "textbook_summaries.txt"

class ProcessingState:
    def __init__(self, total_pages: int, processed_pages: set = None, 
                 pages_processed: int = 0, pages_skipped: int = 0):
        self.total_pages = total_pages
        self.processed_pages = processed_pages or set()
        self.pages_processed = pages_processed
        self.pages_skipped = pages_skipped
        self.start_time = time.time()
        self.last_update = time.time()
    
    def update(self, page_num: int, was_skipped: bool = False):
        self.processed_pages.add(page_num)
        if was_skipped:
            self.pages_skipped += 1
        else:
            self.pages_processed += 1
        self.last_update = time.time()
    
    def get_progress(self) -> dict:
        elapsed = time.time() - self.start_time
        return {
            "total_pages": self.total_pages,
            "processed": len(self.processed_pages),
            "pages_processed": self.pages_processed,
            "pages_skipped": self.pages_skipped,
            "remaining": self.total_pages - len(self.processed_pages),
            "elapsed_time": str(timedelta(seconds=int(elapsed))),
            "last_update": datetime.fromtimestamp(self.last_update).isoformat()
        }

def save_checkpoint(state: ProcessingState, output_file: str, checkpoint_file: str = CHECKPOINT_FILE) -> None:
    """Save the current processing state to a checkpoint file."""
    checkpoint = {
        'state': state,
        'output_file': output_file,
        'timestamp': time.time()
    }
    with open(checkpoint_file, 'wb') as f:
        pickle.dump(checkpoint, f)

def load_checkpoint(checkpoint_file: str = CHECKPOINT_FILE) -> tuple:
    """Load processing state from checkpoint file."""
    try:
        with open(checkpoint_file, 'rb') as f:
            checkpoint = pickle.load(f)
        return checkpoint['state'], checkpoint['output_file'], True
    except (FileNotFoundError, pickle.PickleError, KeyError):
        return None, None, False

def clear_checkpoint(checkpoint_file: str = CHECKPOINT_FILE) -> None:
    """Remove the checkpoint file if it exists, both in script dir and CWD."""
    # Try to remove from script directory
    try:
        os.remove(checkpoint_file)
    except FileNotFoundError:
        pass
    # Also try to remove from current working directory
    try:
        cwd_checkpoint = os.path.join(os.getcwd(), os.path.basename(checkpoint_file))
        if os.path.exists(cwd_checkpoint):
            os.remove(cwd_checkpoint)
    except Exception:
        pass

def call_llm(prompt: str) -> Optional[str]:
    """Call the LLaMA 3.3 70B model via OpenRouter."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OpenRouter API key not found in environment variables")
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Textbook Summarizer"
    }
    
    data = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant that summarizes medical textbook content for a diabetes chatbot."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.2,  # Lower temperature for more factual output
        "max_tokens": 1000
    }
    
    try:
        print("\n" + "="*80)
        print("SENDING REQUEST TO MODEL:")
        print(f"Model: {MODEL_NAME}")
        print("-"*40)
        print(prompt[:1000] + ("..." if len(prompt) > 1000 else ""))
        print("-"*40)
        print(f"Prompt length: {len(prompt)} characters")
        
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=data,
            timeout=60  # 60 seconds timeout
        )
        response.raise_for_status()
        
        result = response.json()["choices"][0]["message"]["content"].strip()
        
        print("\nRECEIVED RESPONSE:")
        print("-"*40)
        print(result[:1000] + ("..." if len(result) > 1000 else ""))
        print("-"*40)
        print(f"Response length: {len(result)} characters")
        print("="*80 + "\n")
        
        return result
    except Exception as e:
        print(f"\nERROR in call_llm: {str(e)}")
        if 'response' in locals() and hasattr(response, 'text'):
            print(f"Response content: {response.text}")
        return None

def process_page(page_text: str, page_num: int) -> str:
    """Process a single page and generate summaries."""
    # Clean and truncate the page text if too long
    page_text = page_text.strip()
    if len(page_text) > 4000:  # Leave room for the prompt
        page_text = page_text[:4000] + "... [content truncated]"
    
    # Create the prompt with the actual page text
    prompt = f"""You are summarizing content from a medical textbook about diabetes for a chatbot knowledge base.

INSTRUCTIONS:
1. Extract key information relevant to diabetes care, treatment, or education
2. Format each distinct piece of information as a standalone paragraph
3. Start each paragraph with a clear, descriptive heading in [SQUARE BRACKETS]
4. Separate paragraphs with exactly '----' on a line by itself
5. Keep paragraphs concise but informative (2-4 sentences each)
6. If content is not relevant, respond with just: [SKIP]

OUTPUT FORMAT EXAMPLE:
[DIABETES TYPES]
Type 1 diabetes is an autoimmune condition...
----
[INSULIN FUNCTION]
Insulin is a hormone produced by the pancreas...

TEXT TO SUMMARIZE:
{page_text}"""
    
    print(f"Page text length: {len(page_text)} characters")
    print("-" * 80)
    print("SAMPLE PAGE TEXT:")
    print(page_text[:500] + ("..." if len(page_text) > 500 else ""))
    print("-" * 80)
    
    response = call_llm(prompt)
    
    if not response or response.strip().upper() == SKIP_KEYWORD or 'SKIP' in response.upper():
        print(f"Page {page_num}: No relevant content found")
        return f"[PAGE {page_num}]\n{SKIP_KEYWORD}\n"
    
    # Clean up the response
    response = response.strip()
    
    # Add the page number as a comment for reference
    response = f"[PAGE {page_num}]\n{response}"
    
    print(f"Page {page_num}: Successfully processed")
    return response

def extract_text_from_pdf(pdf_path: str) -> List[str]:
    """Extract text from each page of the PDF."""
    print(f"Opening PDF file: {pdf_path}")
    try:
        doc = fitz.open(pdf_path)
        pages = []
        total_pages = len(doc)
        print(f"Found {total_pages} pages in the PDF")
        
        for page_num in range(total_pages):
            try:
                page = doc.load_page(page_num)
                text = page.get_text("text")
                if not text.strip():
                    print(f"Warning: Page {page_num + 1} appears to be empty")
                pages.append(text)
            except Exception as e:
                print(f"Error extracting text from page {page_num + 1}: {str(e)}")
                pages.append("")  # Add empty string for failed pages
        
        return pages
    except Exception as e:
        print(f"Error opening PDF file: {str(e)}")
        raise

def chunk_text(text: str) -> list:
    """Split text into chunks based on the separator."""
    return [chunk.strip() for chunk in text.split('----') if chunk.strip()]

def show_status() -> None:
    """Show current processing status from checkpoint if available."""
    state, output_file, exists = load_checkpoint()
    if not exists or not state:
        print("No checkpoint found. No processing in progress.")
        return
    
    progress = state.get_progress()
    print("\n=== PROCESSING STATUS ===")
    print(f"Output file: {output_file}")
    print(f"Total pages: {progress['total_pages']}")
    print(f"Pages processed: {progress['pages_processed']}")
    print(f"Pages skipped: {progress['pages_skipped']}")
    print(f"Remaining pages: {progress['remaining']}")
    print(f"Elapsed time: {progress['elapsed_time']}")
    print(f"Last update: {progress['last_update']}")
    print("========================\n")

def process_textbook(pdf_path: str, output_file: str, test_mode: bool = False, 
                   resume: bool = False, clear: bool = False):
    """Process the textbook and save summaries to a file.
    
    Args:
        pdf_path: Path to the PDF file
        output_file: Path to save the output
        test_mode: If True, only process first 30 pages in batches of 3
        resume: If True, resume from checkpoint if available
        clear: If True, clear existing checkpoint and start fresh
    """
    # Handle checkpoint clearing
    if clear:
        clear_checkpoint()
        print("Checkpoint cleared. Starting fresh processing.")
        # Always start with a fresh state and overwrite output file
        all_pages = extract_text_from_pdf(pdf_path)
        if test_mode:
            all_pages = all_pages[:30]
            print(f"TEST MODE: Processing first 30 pages in batches of 3")
        total_pages = len(all_pages)
        state = ProcessingState(total_pages=total_pages)
        # Always open output file in write mode and write header below
        resume = False
        has_checkpoint = False
        checkpoint_output = None
    else:
        # Load checkpoint if resuming
        all_pages = None
        state, checkpoint_output, has_checkpoint = load_checkpoint()
        if resume and has_checkpoint and state:
            if checkpoint_output == output_file:
                print(f"Resuming from checkpoint for {output_file}")
                print(f"Already processed: {len(state.processed_pages)} pages")
                print(f"Pages to process: {state.total_pages - len(state.processed_pages)}")
            else:
                print(f"Found checkpoint for different output file: {checkpoint_output}")
                print("Starting fresh processing...")
                state = None
        if not state:
            print(f"Extracting text from {pdf_path}...")
            all_pages = extract_text_from_pdf(pdf_path)
            if test_mode:
                all_pages = all_pages[:30]  # First 30 pages for testing
                print(f"TEST MODE: Processing first 30 pages in batches of 3")
            total_pages = len(all_pages)
            state = ProcessingState(total_pages=total_pages)
            print(f"Starting new processing session with {total_pages} pages")

    
    batch_size = 3 if test_mode else 1
    print(f"Found {state.total_pages} pages to process{' (test mode)' if test_mode else ''}.")
    
    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(os.path.abspath(output_file))
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Decide file mode and header logic
    output_exists = os.path.exists(output_file)
    # Only write header if starting fresh (not resuming, not using checkpoint, or file doesn't exist)
    if clear or (not resume and not (has_checkpoint and checkpoint_output == output_file and output_exists)):
        mode = 'w'
    else:
        mode = 'a'
    with open(output_file, mode, encoding='utf-8') as f:
        if mode == 'w':
            f.write(f"# DIABETES_TEXTBOOK_SUMMARIES\n")
            f.write(f"SOURCE: {os.path.basename(pdf_path)}\n")
            f.write(f"GENERATED: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"FORMAT_VERSION: 1.0\n\n")
        
        # Process pages
        for page_num in range(1, state.total_pages + 1):
            # Skip already processed pages when resuming
            if page_num - 1 in state.processed_pages:  # -1 because pages are 1-indexed in display
                print(f"Skipping already processed page {page_num}")
                continue
                
            try:
                # Only load all_pages if we haven't already
                if all_pages is None:
                    all_pages = extract_text_from_pdf(pdf_path)
                    if test_mode:
                        all_pages = all_pages[:30]
                        
                page_text = all_pages[page_num - 1]  # -1 because list is 0-indexed
                
                # Skip empty or minimal content pages
                if not page_text.strip() or len(page_text.strip()) < 50:
                    print(f"Page {page_num}: Empty or minimal content, skipping...")
                    state.update(page_num - 1, was_skipped=True)
                    save_checkpoint(state, output_file)
                    continue
                    
                print(f"\nProcessing page {page_num}...")
                summary = process_page(page_text, page_num)
                
                # Only write if we have a valid summary (not SKIP)
                if summary and summary.strip() != f"[PAGE {page_num}]\n{SKIP_KEYWORD}\n":
                    # Remove the [PAGE X] line and any extra newlines
                    summary_lines = summary.split('\n')[1:]  # Skip the [PAGE X] line
                    cleaned_summary = '\n'.join(line for line in summary_lines if line.strip() != SKIP_KEYWORD)
                    
                    if cleaned_summary.strip():
                        f.write(cleaned_summary.strip() + '\n')
                        f.write('----\n')
                        f.flush()
                        state.update(page_num - 1, was_skipped=False)
                    else:
                        state.update(page_num - 1, was_skipped=True)
                else:
                    state.update(page_num - 1, was_skipped=True)
                    
                print(f"Completed {len(state.processed_pages)}/{state.total_pages} pages")
                
                # Save checkpoint after each successful page
                try:
                    save_checkpoint(state, output_file)
                    print(f"Checkpoint saved after page {page_num}")
                except Exception as e:
                    print(f"Warning: Failed to save checkpoint: {str(e)}")
                
                # Add delay between batches in test mode
                if test_mode and page_num % 3 == 0:
                    print(f"Test mode: Waiting {REQUEST_DELAY} seconds before next batch...")
                    time.sleep(REQUEST_DELAY)
                
            except KeyboardInterrupt:
                print("\nProcessing interrupted by user. Saving progress...")
                save_checkpoint(state, output_file)
                print(f"Progress saved. You can resume later with --resume")
                return
            except Exception as e:
                print(f"Error processing page {page_num}: {str(e)}")
                try:
                    state.update(page_num - 1, was_skipped=True)
                    save_checkpoint(state, output_file)
                    print(f"Checkpoint updated after error on page {page_num}")
                except Exception as save_error:
                    print(f"Critical: Failed to save checkpoint after error: {str(save_error)}")
        
        # Add summary of processing if not in test mode
        if not test_mode:
            f.write(f"\n# PROCESSING SUMMARY\n")
            f.write(f"Total pages: {state.total_pages}\n")
            f.write(f"Pages processed: {state.pages_processed}\n")
            f.write(f"Pages skipped: {state.pages_skipped}\n")
    
    # Clean up checkpoint on successful completion
    try:
        clear_checkpoint()
        print("Processing completed successfully. Checkpoint cleared.")
    except Exception as e:
        print(f"Warning: Failed to clear checkpoint: {str(e)}")
    
    print(f"\nProcessing complete! Summaries saved to {output_file}")
    print(f"Pages processed: {state.pages_processed}, Pages skipped: {state.pages_skipped}")
    if test_mode:
        print("\nTest mode completed. To process the full document, run without --test flag.")

def parse_summaries_file(filepath: str) -> list:
    """Parse the generated summaries file into structured chunks."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Skip the header section (everything before the first [PAGE X] marker)
    page_marker = content.find('[PAGE ')
    if page_marker > 0:
        content = content[page_marker:]
    
    chunks = []
    current_page = None
    current_content = []
    
    for line in content.split('\n'):
        line = line.strip()
        if line.startswith('[PAGE '):
            if current_page is not None:
                chunks.append({
                    'page': current_page,
                    'content': '\n'.join(current_content).strip()
                })
            current_page = line.strip('[]')
            current_content = []
        elif line and line != SKIP_KEYWORD and not line.startswith('---'):
            current_content.append(line)
    
    # Add the last page
    if current_page is not None:
        chunks.append({
            'page': current_page,
            'content': '\n'.join(current_content).strip()
        })
    
    # Filter out empty or skipped pages
    return [chunk for chunk in chunks if chunk['content'] and chunk['content'] != SKIP_KEYWORD]

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Process a diabetes textbook and generate summaries using LLaMA 3.3 70B.')
    parser.add_argument('--status', action='store_true', help='Show current processing status and exit')
    parser.add_argument('pdf_path', nargs='?', type=str, help='Path to the PDF file to process')
    parser.add_argument('--output', type=str, default=OUTPUT_FILE, 
                       help=f'Output file path (default: {OUTPUT_FILE})')
    parser.add_argument('--parse-only', action='store_true',
                       help='Parse an existing output file instead of processing a PDF')
    parser.add_argument('--test', action='store_true',
                       help='Test mode: process only first 30 pages in batches of 3')
    parser.add_argument('--resume', action='store_true',
                       help='Resume from last checkpoint if available')
    parser.add_argument('--clear', action='store_true',
                       help='Clear existing checkpoint and start fresh')
    
    args = parser.parse_args()

    # Handle --status flag
    if args.status:
        show_status()
        exit(0)

    if args.parse_only:
        if not os.path.exists(args.output):
            print(f"Error: File '{args.output}' not found.")
        else:
            chunks = parse_summaries_file(args.output)
            print(f"Found {len(chunks)} content chunks in {args.output}")
            if chunks:
                print("\nSample chunk:")
                print(f"Page: {chunks[0]['page']}")
                print(f"Content: {chunks[0]['content']}")
    else:
        if not os.path.exists(args.pdf_path):
            print(f"Error: File '{args.pdf_path}' not found.")
        else:
            process_textbook(args.pdf_path, args.output, test_mode=args.test)
            if args.test:
                print("\nTest mode completed. To process the full document, run without --test flag.")
            else:
                print("\nProcessing complete! Use --parse-only to parse and analyze the generated file.")
