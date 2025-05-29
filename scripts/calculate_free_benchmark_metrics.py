import json
import os
from pathlib import Path
from collections import defaultdict
from datetime import datetime

def calculate_metrics(result_file):
    with open(result_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Initialize counters
    correct = 0
    total = 0
    
    # Count correct and total answers
    for q_id, q_data in data['questions'].items():
        if 'binary_correct' in q_data:
            correct += q_data['binary_correct']
            total += 1
    
    # Calculate accuracy
    accuracy = (correct / total) * 100 if total > 0 else 0
    
    return {
        'model': data['model'],
        'timestamp': data.get('timestamp', 'N/A'),
        'total_questions': total,
        'correct_answers': correct,
        'incorrect_answers': total - correct,
        'accuracy': accuracy
    }

def generate_markdown_table(results):
    """Generate a markdown formatted table from results."""
    table = [
        "# Free-Form Answer Benchmark Results\n",
        "| Model | Timestamp | Total | Correct | Incorrect | Accuracy |",
        "|-------|-----------|-------|---------|-----------|----------|"
    ]
    
    for result in results:
        table.append(
            f"| {result['model']} | {result['timestamp']} | "
            f"{result['total_questions']} | {result['correct_answers']} | "
            f"{result['incorrect_answers']} | {result['accuracy']:.2f}% |"
        )
    
    return '\n'.join(table) + '\n'

def main():
    # Base directory
    base_dir = Path(r"c:\Users\Usuario\OneDrive\Desktop\PFA\Diabot-V2\Benchmarking-QA-Datasets")
    output_file = base_dir / "free_form_benchmark_results.md"
    
    # Files to process
    benchmark_files = list((base_dir / "Benchmark_Results").glob("benchmark_free_*.json"))
    
    # Sort files by modification time (newest first)
    benchmark_files.sort(key=os.path.getmtime, reverse=True)
    
    # Take the two most recent files if they exist
    files_to_process = benchmark_files[:2] if len(benchmark_files) >= 2 else benchmark_files
    
    if not files_to_process:
        print("No benchmark result files found in the Benchmark_Results directory.")
        return
    
    # Calculate metrics for each file
    results = []
    for file_path in files_to_process:
        try:
            results.append(calculate_metrics(file_path))
            print(f"Processed: {file_path.name}")
        except Exception as e:
            print(f"Error processing {file_path.name}: {str(e)}")
    
    if not results:
        print("No valid results were generated.")
        return
    
    # Generate markdown content
    markdown_content = generate_markdown_table(results)
    
    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    # Also print to console
    print("\n" + "="*80)
    print(f"Results have been saved to: {output_file}")
    print("="*80 + "\n")
    print(markdown_content)

if __name__ == "__main__":
    main()
