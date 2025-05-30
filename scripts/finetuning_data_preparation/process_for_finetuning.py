import json
import requests
import time
import csv
import os
from collections import defaultdict

def load_correct_answers(file_path):
    """Load correct answers from JSON file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Extract all correct answers from all models
    all_answers = []
    for model_data in data:
        all_answers.extend(model_data['correct_answers'])
    
    return all_answers

def find_duplicate_questions(answers):
    """Find duplicate questions and their indices."""
    question_indices = defaultdict(list)
    for i, answer in enumerate(answers):
        # Use lowercase for case-insensitive comparison
        question_text = answer['question'].lower().strip()
        question_indices[question_text].append(i)
    
    # Filter to only keep questions that appear more than once
    duplicates = {q: indices for q, indices in question_indices.items() if len(indices) > 1}
    return duplicates

def paraphrase_with_openrouter(text, api_key=None):
    """Paraphrase text using OpenRouter API with Gemini Flash 2.7."""
    if not api_key:
        # If no API key is provided, return a simple modification of the original
        return f"Rephrased: {text}"
    
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "google/gemini-flash-2.7",
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful assistant that paraphrases questions about diabetes. Keep the same meaning but change the wording. Maintain the same language as the original (French or English)."
            },
            {
                "role": "user",
                "content": f"Please paraphrase this question about diabetes, keeping the same meaning but using different wording: '{text}'"
            }
        ]
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        paraphrased_text = result['choices'][0]['message']['content']
        return paraphrased_text.strip()
    except Exception as e:
        print(f"Error paraphrasing text: {e}")
        # If API call fails, return a slightly modified version of the original
        return f"Rephrased: {text}"

def process_answers_for_finetuning(input_file, output_file, api_key=None, use_openrouter=False):
    """Process answers for finetuning and save to CSV."""
    # Load data
    print(f"Loading data from {input_file}...")
    answers = load_correct_answers(input_file)
    
    # Find duplicates
    print("Finding duplicate questions...")
    duplicates = find_duplicate_questions(answers)
    
    # Process duplicates if any
    if duplicates:
        print(f"Found {sum(len(indices) - 1 for indices in duplicates.values())} duplicate questions to paraphrase.")
        
        # Paraphrase if use_openrouter is True
        if use_openrouter:
            # For each set of duplicates, keep the first one and paraphrase the rest
            for question_text, indices in duplicates.items():
                # Skip the first occurrence (keep it as is)
                for idx in indices[1:]:
                    original_question = answers[idx]['question']
                    print(f"Paraphrasing: {original_question}")
                    
                    # Paraphrase the question
                    paraphrased = paraphrase_with_openrouter(original_question, api_key)
                    answers[idx]['question'] = paraphrased
                    
                    # Add a small delay to avoid API rate limits
                    time.sleep(1)
    
    # Renumber question_ids from 1 to N
    print("Renumbering questions from 1 to N...")
    for i, answer in enumerate(answers, 1):
        answer['question_id'] = str(i)
    
    # Write to CSV file
    print(f"Writing processed data to {output_file}...")
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        # Write header
        writer.writerow(['question_id', 'question', 'model_answer'])
        # Write data
        for answer in answers:
            writer.writerow([
                answer['question_id'],
                answer['question'],
                answer['model_answer']
            ])
    
    print(f"Processing complete! {len(answers)} questions processed and saved to {output_file}")

if __name__ == "__main__":
    import os
    from pathlib import Path
    
    # Get the project root directory (two levels up from this script)
    project_root = Path(__file__).parent.parent.parent
    input_file = project_root / "Benchmarking" / "Second-Method-Results" / "correct_answers.json"
    output_file = project_root / "finetuning_data.csv"
    
    # Set to True and provide API key if you want to use OpenRouter for paraphrasing
    use_openrouter = False
    api_key = None  # Your OpenRouter API key if use_openrouter is True
    
    # If you don't want to use OpenRouter, the script will add a simple prefix to duplicates
    # If you want to use OpenRouter, set use_openrouter to True and provide your API key
    process_answers_for_finetuning(input_file, output_file, api_key, use_openrouter)
