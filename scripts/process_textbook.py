import os
import re
import torch
import chromadb
import pdfplumber
import time
import sys
import subprocess
from datetime import datetime
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
from dataclasses import dataclass
from tqdm import tqdm

# Install required packages if not already installed
try:
    import huggingface_hub
except ImportError:
    print("Installing required packages...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface-hub", "sentence-transformers"])
    import huggingface_hub

def print_step(message):
    print(f"\n{'='*50}")
    print(f"{message}")
    print(f"{'='*50}")

def print_info(message):
    print(f"[INFO] {message}")

def print_error(message):
    print(f"[ERROR] {message}")

def print_warning(message):
    print(f"[WARNING] {message}")

def print_success(message):
    print(f"[SUCCESS] {message}")

@dataclass
class DocumentChunk:
    text: str
    metadata: Dict[str, str]
    id: str

class TextbookProcessor:
    def __init__(self, pdf_path: str, model_name: str = "BAAI/bge-large-en-v1.5"):
        self.start_time = time.time()
        self.pdf_path = pdf_path
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Create models directory if it doesn't exist
        self.models_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models')
        os.makedirs(self.models_dir, exist_ok=True)
        
        print_info(f"Initializing TextbookProcessor with model: {model_name}")
        print_info(f"Using device: {self.device}")
        print_info(f"Models directory: {self.models_dir}")
        
        if torch.cuda.is_available():
            print_info(f"GPU: {torch.cuda.get_device_name(0)}")
            print_info(f"CUDA version: {torch.version.cuda}")
            print_info(f"PyTorch version: {torch.__version__}")
        
        # Initialize the embedding model with local cache
        print_info(f"Loading embedding model: {model_name}")
        model_load_start = time.time()
        
        # Set up model paths
        model_path = os.path.join(self.models_dir, 'BAAI_bge-large-en-v1.5')
        os.makedirs(model_path, exist_ok=True)
        
        # Check if model is already downloaded
        model_exists = os.path.exists(os.path.join(model_path, 'config.json'))
        
        if model_exists:
            print_info("Using locally cached model")
            model_name = model_path  # Use local path if model exists
        else:
            print_info("Model not found locally, downloading... (this may take a while, ~1.3GB)")
        
        try:
            # Load the model with explicit configuration
            self.embedding_model = SentenceTransformer(
                model_name,
                device=self.device,
                cache_folder=model_path,
                trust_remote_code=True  # Required for some models
            )
            
            # Increase max sequence length for better handling of long documents
            self.embedding_model.max_seq_length = 512
            
            if not model_exists:
                print_success(f"Model downloaded and saved to: {model_path}")
            
            print_success(f"Model loaded in {time.time() - model_load_start:.2f} seconds")
            
        except Exception as e:
            print_error(f"Failed to load model: {str(e)}")
            print_info("Attempting to download from Hugging Face directly...")
            
            # Fallback: Try to download the model directly
            try:
                from huggingface_hub import snapshot_download
                snapshot_download(
                    repo_id="BAAI/bge-large-en-v1.5",
                    local_dir=model_path,
                    local_dir_use_symlinks=False
                )
                print_success("Model downloaded successfully!")
                
                # Try loading again
                self.embedding_model = SentenceTransformer(
                    model_path,
                    device=self.device,
                    trust_remote_code=True
                )
                self.embedding_model.max_seq_length = 512
                print_success("Successfully loaded model after download")
                
            except Exception as e2:
                print_error(f"Failed to download model: {str(e2)}")
                raise RuntimeError("Could not load or download the embedding model. Please check your internet connection and try again.")
        
        # Initialize ChromaDB
        print_info("Initializing ChromaDB client")
        self.client = chromadb.HttpClient(
            host='localhost',
            port=8000,
            ssl=False,
            headers={
                'Authorization': 'Bearer test-token'
            }
        )
        print_info("Connected to ChromaDB server")
        
        # Get or create collection
        self.collection_name = "diabetes_textbook"
        try:
            # First try to get the collection
            self.collection = self.client.get_collection(name=self.collection_name)
            print_info(f"Using existing collection: {self.collection_name}")
            
            # Clear any existing data
            print_info("Clearing any existing data from the collection...")
            self.collection.delete(where={"$exists": True})
            print_success(f"Cleared existing data from collection: {self.collection_name}")
            
        except Exception as e:
            print_info(f"Creating new collection: {self.collection_name}")
            self.collection = self.client.create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            print_success(f"Created new collection: {self.collection_name}")
            
        # Clear any existing data in the collection
        print_info("Clearing any existing data from the collection...")
        try:
            self.collection.delete(where={"$exists": True})
        except Exception as e:
            print_error(f"Error clearing collection: {str(e)}")
            print_info("Continuing with insert...")
        self.collection.delete(where={"$exists": True})
    
    def extract_text_with_metadata(self, test_mode: bool = False) -> List[DocumentChunk]:
        """Extract text and metadata from PDF"""
        print_step("Starting PDF Processing")
        print_info(f"PDF: {self.pdf_path}")
        print_info(f"File size: {os.path.getsize(self.pdf_path) / (1024*1024):.2f} MB")
        if test_mode:
            print_warning("TEST MODE: Processing only first 10 pages")
        
        chunks = []
        current_chapter = "Introduction"
        current_section = ""
        chunk_id = 0
        total_pages = 0
        start_time = time.time()
        
        # First pass to count total pages for progress bar
        with pdfplumber.open(self.pdf_path) as pdf:
            total_pages = len(pdf.pages)
            if test_mode:
                total_pages = min(10, total_pages)
                print_info(f"Found {total_pages} pages (test mode)")
            else:
                print_info(f"Found {total_pages} pages in the document")
        
        with pdfplumber.open(self.pdf_path) as pdf:
            # In test mode, only process first 10 pages or less if PDF is smaller
            pages_to_process = pdf.pages[:total_pages]
            
            # Create progress bar with total pages we're actually processing
            page_iterator = tqdm(
                enumerate(pages_to_process, 1), 
                desc="Processing pages", 
                total=total_pages
            )
            
            for page_num, page in page_iterator:
                page_start_time = time.time()
                text = page.extract_text() or ""
                if not text:
                    print(f"[DEBUG] Page {page_num} has no extractable text")
                    continue
                    
                # Update progress in the progress bar
                page_iterator.set_postfix({
                    'chunks': len(chunks),
                    'time': f"{time.time() - start_time:.1f}s"
                }, refresh=False)
                
                # Show progress every page in test mode, every 10 pages otherwise
                if test_mode or page_num % 10 == 0:
                    print(f"[PROGRESS] Page {page_num}/{total_pages} - {len(chunks)} chunks created")
                
                # Simple chapter/section detection (you might need to adjust based on your PDF structure)
                lines = text.split('\n')
                first_line = lines[0].strip() if lines else ""
                
                # Update chapter/section if we find a heading
                if first_line.startswith('Chapter '):
                    current_chapter = first_line
                    current_section = ""
                elif first_line.isupper() and len(first_line) < 100:  # Likely a section heading
                    current_section = first_line
                
                # Create chunks (adjust chunk_size as needed)
                chunk_size = 500  # characters per chunk
                for i in range(0, len(text), chunk_size):
                    chunk_text = text[i:i + chunk_size].strip()
                    if not chunk_text:
                        continue
                        
                    chunk_metadata = {
                        "chapter": current_chapter,
                        "section": current_section,
                        "page": str(page_num + 1),
                        "source": os.path.basename(self.pdf_path)
                    }
                    
                    chunks.append(DocumentChunk(
                        text=chunk_text,
                        metadata=chunk_metadata,
                        id=f"chunk_{chunk_id}"
                    ))
                    chunk_id += 1
                
                # Log page processing time
                page_iterator.set_postfix({"chunks": len(chunks), "time": f"{time.time() - page_start_time:.1f}s"})
        
        print_success(f"PDF processing complete! Created {len(chunks)} chunks from {total_pages} pages")
        return chunks
    
    def generate_embeddings(self, chunks: List[DocumentChunk]) -> List[List[float]]:
        """Generate embeddings for the text chunks"""
        print_step("Generating Embeddings")
        print_info(f"Processing {len(chunks)} chunks")
        print_info(f"Using model: {self.model_name} on {self.device}")
        
        texts = [chunk.text for chunk in chunks]
        total_chars = sum(len(text) for text in texts)
        print_info(f"Total characters to process: {total_chars:,}")
        
        # Process in batches to avoid OOM
        batch_size = 32
        all_embeddings = []
        total_batches = (len(texts) + batch_size - 1) // batch_size
        
        print_info(f"Processing in {total_batches} batches of size {batch_size}")
        print("This may take a while. Please wait...")
        
        batch_times = []
        with tqdm(total=len(texts), desc="Generating embeddings", unit="chunk") as pbar:
            for i in range(0, len(texts), batch_size):
                batch_start = time.time()
                batch_texts = texts[i:i + batch_size]
                
                try:
                    batch_embeddings = self.embedding_model.encode(
                        batch_texts,
                        batch_size=batch_size,
                        show_progress_bar=False,
                        convert_to_numpy=True
                    )
                    all_embeddings.extend(batch_embeddings.tolist())
                    
                    # Calculate and log batch statistics
                    batch_time = time.time() - batch_start
                    batch_times.append(batch_time)
                    avg_time = sum(batch_times) / len(batch_times)
                    remaining_batches = total_batches - (i // batch_size + 1)
                    eta = avg_time * remaining_batches
                    
                    pbar.update(len(batch_texts))
                    pbar.set_postfix({
                        "avg_batch_time": f"{avg_time:.2f}s",
                        "ETA": f"{eta/60:.1f}min" if eta > 60 else f"{eta:.0f}s"
                    })
                    
                except Exception as e:
                    print_error(f"Error processing batch {i//batch_size + 1}: {str(e)}")
                    raise
        
        print_success(f"Generated {len(all_embeddings)} embeddings")
        if batch_times:
            speed = len(batch_times)*batch_size/sum(batch_times)
            print_info(f"Average speed: {speed:.1f} chunks/second")
        
        return all_embeddings
    
    def store_in_chroma(self, chunks: List[DocumentChunk], embeddings: List[List[float]]):
        """Store chunks and embeddings in ChromaDB"""
        print_step("Storing in ChromaDB")
        print_info("Storing chunks and embeddings")
        
        # Prepare data for ChromaDB
        batch_size = 50  # Reduced batch size to prevent memory issues
        total_chunks = len(chunks)
        
        print_info(f"Storing {total_chunks} chunks in batches of {batch_size}")
        
        # Clear existing data first
        print_info("Clearing any existing data from the collection...")
        try:
            self.collection.delete(where={"$exists": True})
        except Exception as e:
            print_error(f"Error clearing collection: {str(e)}")
            print_info("Continuing with insert...")
        
        # Process in smaller batches
        success_count = 0
        for i in tqdm(range(0, total_chunks, batch_size), desc="Storing in ChromaDB"):
            batch_chunks = chunks[i:i + batch_size]
            batch_embeddings = embeddings[i:i + batch_size]
            
            # Skip empty batches
            if not batch_chunks:
                continue
                
            ids = [str(chunk.id) for chunk in batch_chunks]  # Ensure IDs are strings
            documents = [chunk.text for chunk in batch_chunks]
            metadatas = [chunk.metadata for chunk in batch_chunks]
            
            # Ensure we have valid data
            if not all([ids, documents, metadatas, batch_embeddings]):
                print_error(f"Skipping batch {i//batch_size + 1} due to missing data")
                continue
                
            try:
                # Add with retry logic
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        self.collection.upsert(
                            documents=documents,
                            embeddings=batch_embeddings,
                            metadatas=metadatas,
                            ids=ids
                        )
                        success_count += len(batch_chunks)
                        print(f"[PROGRESS] Stored batch {i//batch_size + 1}/{(total_chunks + batch_size - 1)//batch_size} "
                              f"(Attempt {attempt + 1}/{max_retries})", end='\r')
                        break
                    except Exception as e:
                        if attempt == max_retries - 1:  # Last attempt
                            print_error(f"Failed to store batch {i//batch_size + 1} after {max_retries} attempts: {str(e)}")
                            print_info(f"Batch size was: {len(batch_chunks)}")
                            # Try with even smaller batch if possible
                            if len(batch_chunks) > 10:
                                print_info("Trying with smaller batch size...")
                                half_size = len(batch_chunks) // 2
                                self.store_in_chroma(batch_chunks[:half_size], batch_embeddings[:half_size])
                                self.store_in_chroma(batch_chunks[half_size:], batch_embeddings[half_size:])
                                break
                            else:
                                print_error("Batch size already small, giving up on this batch")
                        else:
                            print(f"[RETRY] Attempt {attempt + 1} failed: {str(e)}")
                            time.sleep(1)  # Wait before retry
                            
            except Exception as e:
                print_error(f"Unexpected error in batch {i//batch_size + 1}: {str(e)}")
                print_info("Skipping this batch and continuing...")
                continue
        
        # Log collection statistics
        try:
            collection_count = self.collection.count()
            print_success(f"Successfully stored {success_count}/{total_chunks} chunks in ChromaDB collection '{self.collection_name}'")
            if success_count < total_chunks:
                print_warning(f"Warning: {total_chunks - success_count} chunks were not stored successfully")
        except Exception as e:
            print_error(f"Error getting collection count: {str(e)}")
            print_info(f"Successfully processed at least {success_count} chunks")
    
    def process(self, test_mode: bool = False):
        """Main processing pipeline
        
        Args:
            test_mode: If True, only process first 10 pages for testing
        """
        try:
            print("\n" + "="*60)
            print(f"{'TEXTBOOK PROCESSING PIPELINE':^60}")
            print(f"{'='*60}")
            print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"Using device: {self.device}")
            if torch.cuda.is_available():
                print(f"GPU: {torch.cuda.get_device_name(0)}")
            print("="*60 + "\n")
            
            # Extract text and metadata
            print_step("1/3 - Extracting text and metadata from PDF")
            chunks = self.extract_text_with_metadata(test_mode=test_mode)
            print_success(f"Extracted {len(chunks)} chunks from the textbook")
            
            # Generate embeddings
            print_step("2/3 - Generating embeddings")
            embeddings = self.generate_embeddings(chunks)
            print_success("Embedding generation completed")
            
            # Store in ChromaDB
            print_step("3/3 - Storing in ChromaDB")
            self.store_in_chroma(chunks, embeddings)
            print_success("Data storage completed")
            
            # Calculate and print total processing time
            total_time = time.time() - self.start_time
            hours, rem = divmod(total_time, 3600)
            minutes, seconds = divmod(rem, 60)
            time_str = f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"
            
            print("\n" + "="*60)
            print(f"{'PROCESSING COMPLETE':^60}")
            print("="*60)
            print(f"Total processing time: {time_str}")
            print(f"Chunks processed: {len(chunks)}")
            print(f"Embedding dimensions: {len(embeddings[0]) if embeddings else 0}")
            print("="*60 + "\n")
            
        except Exception as e:
            print("\n" + "!"*60)
            print(f"ERROR: {str(e)}")
            print("!"*60 + "\n")
            raise

if __name__ == "__main__":
    import argparse
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Process PDF textbook into embeddings')
    parser.add_argument('--test', action='store_true', help='Run in test mode (first 10 pages only)')
    args = parser.parse_args()
    
    # Path to your PDF file
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        pdf_path = os.path.abspath(os.path.join(script_dir, "..", "data", "rag_sources", "Textbook-of-Diabetes.pdf"))
        
        print(f"Looking for PDF at: {pdf_path}")
        
        if not os.path.exists(pdf_path):
            print_error(f"PDF file not found at: {pdf_path}")
            print("Please make sure the PDF file exists at the specified location.")
            print("Expected path: data/rag_sources/Textbook-of-Diabetes.pdf")
            raise FileNotFoundError(f"PDF file not found at: {pdf_path}")
            
        print_success(f"Found PDF file: {pdf_path}")
    
        # Initialize and run the processor
        processor = TextbookProcessor(pdf_path)
        processor.process(test_mode=args.test)
        
    except Exception as e:
        print("\n" + "!"*60)
        print("FATAL ERROR: The script encountered an unexpected error")
        print(f"Error: {str(e)}")
        print("!"*60 + "\n")
        raise
