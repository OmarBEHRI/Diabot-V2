import os
import csv
import time
import json
import argparse
import pandas as pd
from dotenv import load_dotenv
import requests
from pathlib import Path
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

# Configuration
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
INPUT_CSV = Path(r"c:\Users\Usuario\OneDrive\Desktop\PFA\Diabot-V2\Benchmarking-QA-Datasets\Diabetes_QA_Randomized_Answers.csv")
OUTPUT_DIR = Path(r"c:\Users\Usuario\OneDrive\Desktop\PFA\Diabot-V2\Benchmarking-QA-Datasets\Results")
CORRECT_ANSWERS_JSON = Path(r"c:\Users\Usuario\OneDrive\Desktop\PFA\Diabot-V2\Benchmarking-QA-Datasets\Diabetes_QA_Correct_Answers.json")

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def call_openrouter(prompt, model_name):
    """Call OpenRouter API to get model's answer."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OpenRouter API key not found in environment variables")
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Diabot Medical Assistant"
    }
    
    data = {
        "model": model_name,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.1,  # Low temperature for more deterministic answers
        "max_tokens": 100
    }
    
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=data
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"Error calling OpenRouter API: {e}")
        return None

def get_model_answer(question, options, model_name):
    """Get the model's answer to a multiple-choice question."""
    prompt = f"""You are a medical expert specializing in diabetes. Please answer the following multiple-choice question about diabetes.
    Select the most accurate answer from the options provided. Respond ONLY with the letter of the correct answer (A, B, C, or D).
    
    Example:
    Question: What is the normal range for fasting blood sugar?
    A: 50-70 mg/dL
    B: 70-100 mg/dL
    C: 100-125 mg/dL
    D: Above 126 mg/dL
    
    Correct response: B

    Now answer this question:
    Question: {question}
    
    A: {options['A']}
    B: {options['B']}
    C: {options['C']}
    D: {options['D']}
    
    Your answer (just the letter):"""
    
    response = call_openrouter(prompt, model_name)
    if not response:
        return None
    
    # Extract just the letter from the response
    for letter in ['A', 'B', 'C', 'D']:
        if letter in response or letter.lower() in response:
            return letter
    
    # If no clear letter is found, try to determine the most likely answer
    if 'a' in response.lower():
        return 'A'
    elif 'b' in response.lower():
        return 'B'
    elif 'c' in response.lower():
        return 'C'
    elif 'd' in response.lower():
        return 'D'
    
    # If still no answer, return the first character (assuming it might be the answer)
    if response and len(response) > 0:
        first_char = response[0].upper()
        if first_char in ['A', 'B', 'C', 'D']:
            return first_char
    
    # If all else fails, return None
    return None

def evaluate_model(model_answers, correct_answers):
    """Evaluate model performance by comparing with correct answers."""
    total = len(correct_answers)
    correct = 0
    
    for question_id, correct_option in correct_answers.items():
        if question_id in model_answers and model_answers[question_id] == correct_option:
            correct += 1
    
    accuracy = (correct / total) * 100 if total > 0 else 0
    return {
        "total_questions": total,
        "correct_answers": correct,
        "accuracy": accuracy
    }

def benchmark_model(model_name):
    """Run benchmark on the specified model using the diabetes QA dataset."""
    try:
        # Read the CSV file
        df = pd.read_csv(INPUT_CSV)
        
        # Load correct answers for evaluation
        with open(CORRECT_ANSWERS_JSON, 'r', encoding='utf-8') as f:
            correct_answers = json.load(f)
        
        # Create a dictionary to store the model's answers
        model_answers = {}
        
        # Generate timestamp for the output file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name_safe = model_name.replace('/', '_')
        output_json = OUTPUT_DIR / f"benchmark_{model_name_safe}_{timestamp}.json"
        
        # Process each row
        total = len(df)
        start_time = time.time()
        
        for index, row in df.iterrows():
            question_id = str(row['id'])
            question = row['Question']
            
            # Skip if question_id is not in correct_answers
            if question_id not in correct_answers:
                print(f"Skipping question {question_id} - not found in correct answers")
                continue
            
            # Get options
            options = {
                'A': row['A'],
                'B': row['B'],
                'C': row['C'],
                'D': row['D']
            }
            
            print(f"\nProcessing {index + 1}/{total}: Question {question_id}")
            print(f"Question: {question[:100]}...")
            
            # Get model's answer
            try:
                model_answer = get_model_answer(question, options, model_name)
                
                if model_answer:
                    model_answers[question_id] = model_answer
                    print(f"  Model's answer: {model_answer}")
                    print(f"  Correct answer: {correct_answers[question_id]}")
                    
                    # Save progress after each question
                    with open(output_json, 'w', encoding='utf-8') as f:
                        json.dump(model_answers, f, indent=4, ensure_ascii=False)
                else:
                    print(f"  Failed to get answer for question {question_id}")
                
                # Add a small delay to avoid rate limiting
                time.sleep(1)
                
            except Exception as e:
                print(f"  Error processing question {question_id}: {e}")
                # Save progress even if there was an error
                with open(output_json, 'w', encoding='utf-8') as f:
                    json.dump(model_answers, f, indent=4, ensure_ascii=False)
        
        # Calculate and save evaluation metrics
        end_time = time.time()
        evaluation = evaluate_model(model_answers, correct_answers)
        
        results = {
            "model": model_name,
            "timestamp": timestamp,
            "answers": model_answers,
            "evaluation": evaluation,
            "processing_time_seconds": end_time - start_time
        }
        
        # Save final results
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=4, ensure_ascii=False)
        
        print(f"\nBenchmarking complete! Results saved to: {output_json}")
        print(f"Accuracy: {evaluation['accuracy']:.2f}% ({evaluation['correct_answers']}/{evaluation['total_questions']} correct)")
        print(f"Total processing time: {end_time - start_time:.2f} seconds")
        
    except Exception as e:
        print(f"Error during benchmarking: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Benchmark an OpenRouter model on the diabetes QA dataset.')
    parser.add_argument('model_name', help='The name of the model to benchmark (e.g., "google/gemini-2.5-flash-preview")')
    
    args = parser.parse_args()
    
    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY not found in environment variables.")
        print("Please set the OPENROUTER_API_KEY in your .env file.")
    else:
        print(f"Starting benchmarking with model: {args.model_name}")
        benchmark_model(args.model_name)
