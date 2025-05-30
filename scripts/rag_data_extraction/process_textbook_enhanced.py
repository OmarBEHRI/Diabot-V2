import os
import re
import torch
import chromadb
import json
import time
import sys
import subprocess
import pdfplumber
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sentence_transformers import SentenceTransformer
from dataclasses import dataclass, field
from tqdm import tqdm
from pathlib import Path

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
class DocumentMetadata:
    part: str = ""
    part_title: str = ""
    chapter: Optional[int] = None
    chapter_title: str = ""
    page_number: Optional[int] = None

@dataclass
class DocumentChunk:
    text: str
    metadata: Dict[str, Any]
    document_metadata: DocumentMetadata
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
        
        # Initialize the embedding model
        self._init_embedding_model()
        
        # Initialize ChromaDB
        self._init_chromadb()
    
    def _init_embedding_model(self):
        """Initialize the embedding model with local cache and optimization settings."""
        print_info(f"Loading embedding model: {self.model_name}")
        model_load_start = time.time()
        
        # Set up model paths
        model_path = os.path.join(self.models_dir, 'BAAI_bge-large-en-v1.5')
        os.makedirs(model_path, exist_ok=True)
        
        try:
            # Enable TF32 for faster matrix multiplications on Ampere GPUs
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True
            
            # Load the model with explicit configuration and optimizations
            self.embedding_model = SentenceTransformer(
                self.model_name,
                device=self.device,
                cache_folder=model_path,
                trust_remote_code=True,
                device_map='auto'  # Automatically handle model distribution
            )
            
            # Optimize model settings
            self.embedding_model.max_seq_length = 512
            self.embedding_model = self.embedding_model.half()  # Use mixed precision
            self.embedding_model.eval()  # Set to evaluation mode
            
            # Warm up the model
            with torch.no_grad():
                _ = self.embedding_model.encode(['warmup'])
            
            print_success(f"Model loaded in {time.time() - model_load_start:.2f} seconds")
            
            # Print GPU memory info
            if torch.cuda.is_available():
                print_info(f"GPU Memory Allocated: {torch.cuda.memory_allocated(0)/1024**2:.2f} MB")
                print_info(f"GPU Memory Cached: {torch.cuda.memory_reserved(0)/1024**2:.2f} MB")
            
        except Exception as e:
            print_error(f"Failed to load model: {str(e)}")
            print_info("Attempting to download from Hugging Face directly...")
            self._download_model(model_path)
    
    def _download_model(self, model_path: str):
        """Download model from Hugging Face Hub."""
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
            
        except Exception as e:
            print_error(f"Failed to download model: {str(e)}")
            raise RuntimeError("Could not load or download the embedding model.")
    
    def _init_chromadb(self):
        """Initialize ChromaDB client and collection."""
        print_info("Initializing ChromaDB client")
        self.client = chromadb.HttpClient(
            host='localhost',
            port=8000,
            ssl=False,
            headers={'Authorization': 'Bearer test-token'}
        )
        print_info("Connected to ChromaDB server")
        
        # Get or create collection
        self.collection_name = "diabetes_textbook"
        try:
            self.collection = self.client.get_collection(name=self.collection_name)
            print_info(f"Using existing collection: {self.collection_name}")
            self._clear_collection()
        except Exception:
            self._create_collection()
    
    def _clear_collection(self):
        """Clear existing data from the collection."""
        print_info("Clearing existing data from the collection...")
        try:
            self.collection.delete(where={"$exists": True})
            print_success(f"Cleared existing data from collection: {self.collection_name}")
        except Exception as e:
            print_error(f"Error clearing collection: {str(e)}")
            print_info("Continuing with insert...")
    
    def _create_collection(self):
        """Create a new ChromaDB collection."""
        print_info(f"Creating new collection: {self.collection_name}")
        self.collection = self.client.create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        print_success(f"Created new collection: {self.collection_name}")
    
    def load_metadata(self) -> Tuple[Dict, Dict]:
        """Load and parse the metadata JSON files."""
        base_dir = Path(__file__).parent.parent / "data" / "rag_sources"
        
        # Load chapters metadata
        with open(base_dir / "chapters-distribution.json", 'r', encoding='utf-8') as f:
            chapters_data = json.load(f)
        
        # Load parts metadata
        with open(base_dir / "parts-distribution.json", 'r', encoding='utf-8') as f:
            parts_data = json.load(f)
        
        # Create mappings
        part_title_map = {}
        for part in parts_data:
            part_num = part["part"].split()[1]
            part_title_map[part_num] = part["part"]
        
        # Create page to chapter mapping
        page_chapter_map = {}
        for chapter in chapters_data:
            try:
                start_page, end_page = map(int, chapter["page_range"].split('-'))
                part_num = chapter["part"].split()[1]
                
                for page in range(start_page, end_page + 1):
                    page_chapter_map[page] = {
                        "part": chapter["part"],
                        "part_title": part_title_map.get(part_num, ""),
                        "chapter": chapter["chapter"],
                        "chapter_title": chapter["title"]
                    }
            except (ValueError, IndexError, KeyError) as e:
                print_warning(f"Error processing chapter {chapter.get('chapter')}: {e}")
                continue
        
        return page_chapter_map, part_title_map
    
    def get_metadata_for_page(self, page_number: int, page_chapter_map: Dict) -> DocumentMetadata:
        """Get metadata for a specific page number."""
        metadata = page_chapter_map.get(page_number, {})
        return DocumentMetadata(
            part=metadata.get("part", ""),
            part_title=metadata.get("part_title", ""),
            chapter=metadata.get("chapter"),
            chapter_title=metadata.get("chapter_title", ""),
            page_number=page_number
        )
    
    def extract_text_with_metadata(self, test_mode: bool = False) -> List[DocumentChunk]:
        """Extract text and metadata from PDF using the new chunking approach."""
        print_step("Starting PDF Processing with Enhanced Chunking")
        print_info(f"PDF: {self.pdf_path}")
        print_info(f"File size: {os.path.getsize(self.pdf_path) / (1024*1024):.2f} MB")
        
        # Load metadata
        page_chapter_map, _ = self.load_metadata()
        
        chunks = []
        chunk_id = 0
        total_pages = 0
        start_time = time.time()
        
        # Get total pages for progress tracking
        with pdfplumber.open(self.pdf_path) as pdf:
            total_pages = len(pdf.pages)
            if test_mode:
                total_pages = min(10, total_pages)
                print_info(f"Found {total_pages} pages (test mode)")
            else:
                print_info(f"Found {total_pages} pages in the document")
        
        # Process pages
        with pdfplumber.open(self.pdf_path) as pdf:
            pages_to_process = pdf.pages[:total_pages]
            page_iterator = tqdm(
                enumerate(pages_to_process, 1), 
                desc="Processing pages", 
                total=total_pages
            )
            
            for page_num, page in page_iterator:
                page_start_time = time.time()
                text = page.extract_text() or ""
                if not text:
                    print_warning(f"Page {page_num} has no extractable text")
                    continue
                
                # Get metadata for this page
                doc_metadata = self.get_metadata_for_page(page_num, page_chapter_map)
                
                # Update progress
                page_iterator.set_postfix({
                    'chunks': len(chunks),
                    'time': f"{time.time() - start_time:.1f}s"
                }, refresh=False)
                
                # Create chunks with metadata
                chunk_size = 500  # characters per chunk
                for i in range(0, len(text), chunk_size):
                    chunk_text = text[i:i + chunk_size].strip()
                    if not chunk_text:
                        continue
                    
                    chunk_metadata = {
                        "source": os.path.basename(self.pdf_path),
                        "chunk_size": len(chunk_text),
                        "chunk_index": i // chunk_size,
                        "total_chunks": (len(text) + chunk_size - 1) // chunk_size
                    }
                    
                    chunks.append(DocumentChunk(
                        text=chunk_text,
                        metadata=chunk_metadata,
                        document_metadata=doc_metadata,
                        id=f"chunk_{chunk_id}"
                    ))
                    chunk_id += 1
                
                # Log page processing time
                page_iterator.set_postfix({
                    "chunks": len(chunks),
                    "time": f"{time.time() - page_start_time:.1f}s"
                })
        
        print_success(f"PDF processing complete! Created {len(chunks)} chunks from {total_pages} pages")
        return chunks
    
    def generate_embeddings(self, chunks: List[DocumentChunk]) -> List[List[float]]:
        """Generate embeddings for the text chunks with optimized batching and GPU utilization."""
        print_step("Generating Embeddings")
        print_info(f"Processing {len(chunks)} chunks")
        
        texts = [chunk.text for chunk in chunks]
        total_chars = sum(len(text) for text in texts)
        print_info(f"Total characters to process: {total_chars:,}")
        
        # Optimize batch size based on available GPU memory
        if torch.cuda.is_available():
            total_memory = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)  # in GB
            batch_size = 128 if total_memory >= 16 else 64  # Larger batch for more memory
        else:
            batch_size = 32  # Conservative batch size for CPU
            
        print_info(f"Using batch size: {batch_size}")
        
        all_embeddings = []
        
        # Use torch.no_grad for inference to save memory
        with torch.no_grad(), torch.cuda.amp.autocast():
            with tqdm(total=len(texts), desc="Generating embeddings", unit="chunk") as pbar:
                for i in range(0, len(texts), batch_size):
                    batch_texts = texts[i:i + batch_size]
                    try:
                        # Process batch with optimized settings
                        batch_embeddings = self.embedding_model.encode(
                            batch_texts,
                            batch_size=batch_size,
                            show_progress_bar=False,
                            convert_to_tensor=True,  # Keep on GPU for efficiency
                            normalize_embeddings=True,
                            convert_to_numpy=False  # Keep as tensor for now
                        )
                        
                        # Move to CPU and convert to list in one go
                        all_embeddings.extend(batch_embeddings.cpu().numpy().tolist())
                        pbar.update(len(batch_texts))
                        
                        # Clear CUDA cache periodically
                        if i % (batch_size * 10) == 0 and torch.cuda.is_available():
                            torch.cuda.empty_cache()
                            
                    except RuntimeError as e:
                        if 'out of memory' in str(e).lower():
                            print_warning("CUDA out of memory, reducing batch size and retrying...")
                            batch_size = max(8, batch_size // 2)  # Halve batch size but keep it reasonable
                            print_info(f"Reduced batch size to {batch_size}")
                            continue
                        else:
                            print_error(f"Error processing batch {i//batch_size + 1}: {str(e)}")
                            raise
                    except Exception as e:
                        print_error(f"Unexpected error processing batch {i//batch_size + 1}: {str(e)}")
                        raise
        
        print_success(f"Generated {len(all_embeddings)} embeddings")
        return all_embeddings
    
    def store_in_chroma(self, chunks: List[DocumentChunk], embeddings: List[List[float]]):
        """Store chunks and embeddings in ChromaDB with retry logic."""
        print_step("Storing in ChromaDB")
        print_info(f"Storing {len(chunks)} chunks")
        
        # Prepare data for ChromaDB
        batch_size = 50
        success_count = 0
        
        for i in tqdm(range(0, len(chunks), batch_size), desc="Storing in ChromaDB"):
            batch_chunks = chunks[i:i + batch_size]
            batch_embeddings = embeddings[i:i + batch_size]
            
            if not batch_chunks:
                continue
                
            # Prepare batch data
            ids = [chunk.id for chunk in batch_chunks]
            documents = [chunk.text for chunk in batch_chunks]
            metadatas = [{
                **chunk.metadata,
                "part": chunk.document_metadata.part,
                "part_title": chunk.document_metadata.part_title,
                "chapter": chunk.document_metadata.chapter,
                "chapter_title": chunk.document_metadata.chapter_title,
                "page_number": chunk.document_metadata.page_number
            } for chunk in batch_chunks]
            
            # Store with retry logic
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
                    break
                except Exception as e:
                    if attempt == max_retries - 1:
                        print_error(f"Failed to store batch after {max_retries} attempts: {str(e)}")
                    time.sleep(1)  # Wait before retry
        
        print_success(f"Successfully stored {success_count}/{len(chunks)} chunks in ChromaDB")
    
    def process(self, test_mode: bool = False):
        """Main processing pipeline."""
        print_step("Starting Textbook Processing")
        start_time = time.time()
        
        try:
            # Extract text and metadata
            chunks = self.extract_text_with_metadata(test_mode)
            if not chunks:
                raise ValueError("No content was extracted from the PDF")
            
            # Generate embeddings
            embeddings = self.generate_embeddings(chunks)
            
            # Store in ChromaDB
            self.store_in_chroma(chunks, embeddings)
            
            # Print summary
            processing_time = time.time() - start_time
            print_success(f"Processing completed in {processing_time:.2f} seconds")
            print_info(f"Total chunks processed: {len(chunks)}")
            print_info(f"Average processing speed: {len(chunks)/max(processing_time, 0.1):.1f} chunks/second")
            
            return True
            
        except Exception as e:
            print_error(f"Processing failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    import argparse
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Process a textbook PDF and store it in ChromaDB with enhanced metadata.")
    parser.add_argument("pdf_path", help="Path to the PDF file to process")
    parser.add_argument("--test", action="store_true", help="Run in test mode (process only first 10 pages)")
    parser.add_argument("--model", default="BAAI/bge-large-en-v1.5", 
                       help="Hugging Face model to use for embeddings")
    
    args = parser.parse_args()
    
    # Validate PDF path
    if not os.path.exists(args.pdf_path):
        print_error(f"File not found: {args.pdf_path}")
        sys.exit(1)
    
    # Process the textbook
    try:
        processor = TextbookProcessor(args.pdf_path, args.model)
        success = processor.process(test_mode=args.test)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print_error("Processing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"An error occurred: {str(e)}")
        sys.exit(1) 

    