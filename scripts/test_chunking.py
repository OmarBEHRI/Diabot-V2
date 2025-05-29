import re
import os
import pdfplumber
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from tqdm import tqdm
import json

@dataclass
class TextChunk:
    text: str
    metadata: Dict[str, Any]
    chunk_id: int

def load_sample_text(file_path: str, max_pages: int = 10) -> str:
    """Load sample text from a PDF file."""
    print(f"Loading text from {file_path}...")
    full_text = ""
    with pdfplumber.open(file_path) as pdf:
        total_pages = min(len(pdf.pages), max_pages)
        for page_num in tqdm(range(total_pages), desc="Reading pages"):
            page = pdf.pages[page_num]
            text = page.extract_text() or ""
            full_text += f"\n--- Page {page_num + 1} ---\n{text}"
    return full_text

def split_by_paragraphs(text: str, min_chars: int = 100, max_chars: int = 1000) -> List[Tuple[str, Dict[str, Any]]]:
    """Split text into chunks based on paragraphs."""
    # Split by multiple newlines
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current_chunk = []
    current_length = 0
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        # If this paragraph is too big, split it into sentences
        if len(para) > max_chars:
            sentences = re.split(r'(?<=[.!?])\s+', para)
            for sentence in sentences:
                if current_chunk and (current_length + len(sentence) + 1) > max_chars:
                    chunks.append((" ".join(current_chunk), {"type": "paragraph_chunk"}))
                    current_chunk = []
                    current_length = 0
                current_chunk.append(sentence)
                current_length += len(sentence) + 1
        else:
            if current_chunk and (current_length + len(para) + 1) > max_chars:
                chunks.append((" ".join(current_chunk), {"type": "paragraph_chunk"}))
                current_chunk = []
                current_length = 0
            current_chunk.append(para)
            current_length += len(para) + 1
    
    if current_chunk:
        chunks.append((" ".join(current_chunk), {"type": "paragraph_chunk"}))
    
    return chunks

def split_by_sentences(text: str, min_chars: int = 50, max_chars: int = 500) -> List[Tuple[str, Dict[str, Any]]]:
    """Split text into chunks based on sentences."""
    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = []
    current_length = 0
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        # If current sentence is too long, split it further
        if len(sentence) > max_chars:
            # Split by commas and other natural breaks
            parts = re.split(r'[,;:]\s+', sentence)
            for part in parts:
                part = part.strip()
                if not part:
                    continue
                    
                if current_chunk and (current_length + len(part) + 2) > max_chars:
                    chunks.append((" ".join(current_chunk), {"type": "sentence_chunk"}))
                    current_chunk = []
                    current_length = 0
                current_chunk.append(part)
                current_length += len(part) + 1
        else:
            if current_chunk and (current_length + len(sentence) + 1) > max_chars:
                chunks.append((" ".join(current_chunk), {"type": "sentence_chunk"}))
                current_chunk = []
                current_length = 0
            current_chunk.append(sentence)
            current_length += len(sentence) + 1
    
    if current_chunk:
        chunks.append((" ".join(current_chunk), {"type": "sentence_chunk"}))
    
    return chunks

def split_by_fixed_size(text: str, chunk_size: int = 500, overlap: int = 50) -> List[Tuple[str, Dict[str, Any]]]:
    """Split text into fixed-size chunks with overlap."""
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = min(start + chunk_size, text_length)
        
        # Try to end at a sentence boundary
        if end < text_length:
            # Look for the next sentence end
            next_period = text.find('.', end - 50, end + 50)
            next_newline = text.find('\n', end - 50, end + 50)
            
            if next_period != -1 and next_period > end - 50:
                end = next_period + 1
            elif next_newline != -1 and next_newline > end - 50:
                end = next_newline + 1
        
        chunk = text[start:end].strip()
        if chunk:
            chunks.append((chunk, {"type": "fixed_size_chunk", "chunk_size": chunk_size, "overlap": overlap}))
        
        # Move the start position, accounting for overlap
        start = end - overlap if (end - overlap) > start else end
    
    return chunks

def analyze_chunks(chunks: List[Tuple[str, Dict[str, Any]]], strategy_name: str):
    """Analyze and print statistics about the chunks."""
    if not chunks:
        print(f"No chunks generated for strategy: {strategy_name}")
        return
    
    chunk_lengths = [len(chunk[0]) for chunk in chunks]
    total_chars = sum(chunk_lengths)
    avg_length = total_chars / len(chunks)
    min_length = min(chunk_lengths)
    max_length = max(chunk_lengths)
    
    print(f"\nStrategy: {strategy_name}")
    print(f"  Total chunks: {len(chunks)}")
    print(f"  Total characters: {total_chars:,}")
    print(f"  Average chunk length: {avg_length:.1f} chars")
    print(f"  Min length: {min_length} chars")
    print(f"  Max length: {max_length} chars")
    
    # Print first and last few chunks as examples
    print("\n  Example chunks:")
    for i, (chunk, _) in enumerate(chunks[:2]):
        print(f"  Chunk {i+1} (first 100 chars): {chunk[:100]}...")
    
    if len(chunks) > 2:
        print(f"  ...{len(chunks) - 4} chunks not shown...")
        for i in range(-2, 0, 1):
            print(f"  Chunk {len(chunks) + i + 1} (first 100 chars): {chunks[i][0][:100]}...")
    
    return {
        "strategy": strategy_name,
        "total_chunks": len(chunks),
        "total_chars": total_chars,
        "avg_length": avg_length,
        "min_length": min_length,
        "max_length": max_length,
        "chunks": [{"text": chunk[0], "metadata": chunk[1]} for chunk in chunks[:5]] + 
                 [{"text": "...", "metadata": {"truncated": True}}] + 
                 [{"text": chunks[-1][0], "metadata": chunks[-1][1]}]
    }

def test_chunking_strategies(text: str, output_dir: str = "chunking_results"):
    """Test different chunking strategies on the input text."""
    os.makedirs(output_dir, exist_ok=True)
    results = {}
    
    # Save the original text for reference
    with open(os.path.join(output_dir, "original_text.txt"), "w", encoding="utf-8") as f:
        f.write(text)
    
    # Test paragraph-based chunking
    print("\n" + "="*50)
    print("Testing paragraph-based chunking")
    print("="*50)
    para_chunks = split_by_paragraphs(text)
    para_stats = analyze_chunks(para_chunks, "Paragraph-based")
    results["paragraph"] = para_stats
    
    # Test sentence-based chunking
    print("\n" + "="*50)
    print("Testing sentence-based chunking")
    print("="*50)
    sent_chunks = split_by_sentences(text)
    sent_stats = analyze_chunks(sent_chunks, "Sentence-based")
    results["sentence"] = sent_stats
    
    # Test fixed-size chunking with different sizes
    for size in [300, 500, 1000]:
        print("\n" + "="*50)
        print(f"Testing fixed-size chunking ({size} chars)")
        print("="*50)
        fixed_chunks = split_by_fixed_size(text, chunk_size=size, overlap=size//5)
        fixed_stats = analyze_chunks(fixed_chunks, f"Fixed-size ({size} chars)")
        results[f"fixed_{size}"] = fixed_stats
    
    # Save results to JSON
    with open(os.path.join(output_dir, "chunking_results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\nResults saved to {os.path.abspath(output_dir)}")
    return results

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Test different text chunking strategies.")
    parser.add_argument("pdf_path", help="Path to the PDF file to process")
    parser.add_argument("--max-pages", type=int, default=10, 
                       help="Maximum number of pages to process (default: 10)")
    parser.add_argument("--output-dir", default="chunking_results",
                       help="Directory to save results (default: chunking_results)")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.pdf_path):
        print(f"Error: File not found: {args.pdf_path}")
        exit(1)
    
    # Load the sample text
    text = load_sample_text(args.pdf_path, args.max_pages)
    
    # Test different chunking strategies
    test_chunking_strategies(text, args.output_dir)
