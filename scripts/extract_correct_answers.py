import os
import json

def extract_correct_answers(benchmark_dir, output_file):
    """
    Extract questions with binary_correct=1 from all benchmark files and save to a single file.
    
    Args:
        benchmark_dir: Directory containing benchmark JSON files
        output_file: Path to the output file
    """
    # Store all correct answers
    all_correct_answers = []
    
    # Get all JSON files in the directory
    json_files = [f for f in os.listdir(benchmark_dir) if f.endswith('.json')]
    
    # Process each file
    for json_file in json_files:
        file_path = os.path.join(benchmark_dir, json_file)
        
        try:
            # Load the JSON data
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            model_name = data.get('model', 'Unknown Model')
            timestamp = data.get('timestamp', 'Unknown Time')
            
            # Extract correct answers
            correct_answers = []
            for q_id, q_data in data.get('questions', {}).items():
                if q_data.get('binary_correct') == 1:
                    correct_answers.append({
                        'question_id': q_id,
                        'question': q_data.get('question', ''),
                        'model_answer': q_data.get('model_answer', ''),
                        'reference_answer': q_data.get('reference_answer', ''),
                        'evaluation': q_data.get('evaluation', '')
                    })
            
            # Add to the overall collection
            if correct_answers:
                all_correct_answers.append({
                    'model': model_name,
                    'timestamp': timestamp,
                    'correct_answers': correct_answers
                })
                
            print(f"Processed {json_file}: Found {len(correct_answers)} correct answers")
            
        except Exception as e:
            print(f"Error processing {json_file}: {str(e)}")
    
    # Write all correct answers to the output file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_correct_answers, f, ensure_ascii=False, indent=2)
    
    print(f"\nAll correct answers saved to {output_file}")
    print(f"Total models processed: {len(all_correct_answers)}")
    total_correct = sum(len(model_data['correct_answers']) for model_data in all_correct_answers)
    print(f"Total correct answers: {total_correct}")

if __name__ == "__main__":
    # Directory containing benchmark JSON files
    benchmark_dir = r"c:\Users\Usuario\OneDrive\Desktop\PFA\Diabot-V2\Benchmarking-QA-Datasets\Benchmark_Results"
    
    # Output file path
    output_file = r"c:\Users\Usuario\OneDrive\Desktop\PFA\correct_answers.json"
    
    extract_correct_answers(benchmark_dir, output_file)
