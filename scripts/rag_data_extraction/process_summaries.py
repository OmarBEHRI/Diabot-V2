"""Summaries Processing Script for Diabot RAG System

This script processes the generated summaries and prepares them for the RAG system:
- Loads text summaries generated by the process_textbook.py script
- Generates embeddings using the BAAI/bge-large-en-v1.5 model
- Stores documents and embeddings in ChromaDB for semantic search
- Supports GPU acceleration when available for faster processing
- Used as part of the PDF processing pipeline in the Diabot knowledge base
- Provides the vector database that powers the RAG context retrieval in chat
"""

import os
import sys
import time
import json
import argparse
from typing import List, Dict, Any
from tqdm import tqdm
import numpy as np
from sentence_transformers import SentenceTransformer

# Utility print functions (matching style)
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

import chromadb

class SummariesProcessor:
    def __init__(self, txt_path: str, model_name: str = "BAAI/bge-large-en-v1.5"):
        self.txt_path = txt_path
        self.model_name = model_name
        self.device = "cuda" if self._cuda_available() else "cpu"
        self.embedding_model = None
        self.client = None
        self.collection = None
        self.collection_name = 'summaries_collection'
        self._init_embedding_model()
        self._init_chromadb()

    def _cuda_available(self):
        try:
            import torch
            return torch.cuda.is_available()
        except ImportError:
            return False

    def _init_embedding_model(self):
        print_info(f"Loading embedding model: {self.model_name}")
        self.embedding_model = SentenceTransformer(self.model_name, device=self.device)
        print_success(f"Embedding model loaded on device: {self.device}")

    def _init_chromadb(self):
        print_info("Initializing ChromaDB client")
        self.client = chromadb.HttpClient(
            host='localhost',
            port=8000,
            ssl=False,
            headers={'Authorization': 'Bearer test-token'}
        )
        print_info("Connected to ChromaDB server")
        try:
            self.collection = self.client.get_collection(name=self.collection_name)
            print_info(f"Using existing collection: {self.collection_name}")
            self.collection.delete(where={"$exists": True})
            print_info(f"Cleared existing data from collection: {self.collection_name}")
        except Exception:
            print_info(f"Creating new collection: {self.collection_name}")
            self.collection = self.client.create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            print_info(f"Created new collection: {self.collection_name}")

    def chunk_text(self, test_mode: bool = False) -> List[str]:
        print_step("Reading and chunking summaries.txt")
        with open(self.txt_path, 'r', encoding='utf-8') as f:
            content = f.read()
        # Split by '----' separator
        chunks = [chunk.strip() for chunk in content.split('----') if chunk.strip()]
        print_info(f"Total chunks found: {len(chunks)}")
        if test_mode:
            print_warning("TEST MODE: Only processing first 30 chunks")
            chunks = chunks[:30]
        return chunks

    def generate_embeddings(self, chunks: List[str], batch_size: int = 16) -> List[List[float]]:
        print_step("Generating embeddings with SentenceTransformer")
        embeddings = []
        for i in tqdm(range(0, len(chunks), batch_size), desc="Embedding batches"):
            batch_chunks = chunks[i:i+batch_size]
            batch_embeds = self.embedding_model.encode(batch_chunks, show_progress_bar=False, device=self.device)
            embeddings.extend(batch_embeds.tolist())
        print_success(f"Generated {len(embeddings)} embeddings")
        return embeddings

    def store_in_chroma(self, chunks: List[str], embeddings: List[List[float]], source_path: str):
        print_step("Storing in ChromaDB")
        batch_size = 50
        success_count = 0
        total_chunks = len(chunks)
        for i in tqdm(range(0, total_chunks, batch_size), desc="Storing in ChromaDB"):
            batch_chunks = chunks[i:i + batch_size]
            batch_embeddings = embeddings[i:i + batch_size]
            if not batch_chunks:
                continue
            ids = [f"chunk_{i+j}" for j in range(len(batch_chunks))]
            documents = batch_chunks
            metadatas = [
                {
                    "source": os.path.basename(source_path),
                    "chunk_index": i + j,
                    "chunk_size": len(batch_chunks[j]),
                    "total_chunks": total_chunks
                }
                for j in range(len(batch_chunks))
            ]
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
        print_success(f"Successfully stored {success_count}/{total_chunks} chunks in ChromaDB")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process summaries.txt and generate sentence-transformer embeddings.")
    parser.add_argument("txt_path", help="Path to summaries.txt file")
    parser.add_argument("--model", default="BAAI/bge-large-en-v1.5", help="HuggingFace model name or path")
    parser.add_argument("--test", action="store_true", help="Process only first 30 chunks for testing")
    args = parser.parse_args()

    if not os.path.exists(args.txt_path):
        print_error(f"File not found: {args.txt_path}")
        sys.exit(1)

    processor = SummariesProcessor(args.txt_path, args.model)
    chunks = processor.chunk_text(test_mode=args.test)
    embeddings = processor.generate_embeddings(chunks)
    processor.store_in_chroma(chunks, embeddings, processor.txt_path)
