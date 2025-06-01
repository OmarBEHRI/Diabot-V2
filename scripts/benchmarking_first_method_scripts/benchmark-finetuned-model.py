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
import re

# Load environment variables from .env file
load_dotenv()

# Configuration - Modified for local llama.cpp server
LLAMA_CPP_SERVER_URL = "http://127.0.0.1:8081"

# Get the project root directory (two levels up from this script)
PROJECT_ROOT = Path(__file__).parent.parent.parent
INPUT_CSV = PROJECT_ROOT / "Benchmarking" / "Datasets" / "processed" / "Diabetes_QA_Randomized_Answers.csv"
OUTPUT_DIR = PROJECT_ROOT / "Benchmarking" / "First-Method-Results"
CORRECT_ANSWERS_JSON = PROJECT_ROOT / "Benchmarking" / "Datasets" / "refference-answers" / "Diabetes_QA_Correct_Answers.json"

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def call_local_llama(prompt, model_name="local-gguf", max_retries=2):
    """Call local llama.cpp server to get model's answer with retries and debugging."""
    
    headers = {
        "Content-Type": "application/json"
    }
    
    # More generous parameters for local inference
    data = {
        "prompt": prompt,
        "temperature": 0.1,
        "n_predict": 200,  # More tokens
        "stop": ["Question:", "\n\nQuestion:", "Answer:", "\n\nAnswer:"],  # Cleaner stop tokens
        "repeat_penalty": 1.1,
        "top_k": 40,
        "top_p": 0.9
    }
    
    for attempt in range(max_retries):
        try:
            print(f"    Sending request (attempt {attempt + 1}/{max_retries})...")
            
            response = requests.post(
                f"{LLAMA_CPP_SERVER_URL}/completion",
                headers=headers,
                json=data,
                timeout=60  # Longer timeout for local inference
            )
            response.raise_for_status()
            result = response.json()
            
            print(f"    Raw API response: {result}")
            
            if "content" in result:
                content = result["content"].strip()
                print(f"    Model response: '{content}'")
                return content
            else:
                print(f"    Warning: No 'content' in response: {result}")
                return None
                
        except requests.exceptions.Timeout:
            print(f"    Timeout on attempt {attempt + 1}/{max_retries} (waited 60 seconds)")
            if attempt < max_retries - 1:
                print("    Retrying in 3 seconds...")
                time.sleep(3)
                continue
        except requests.exceptions.ConnectionError as e:
            print(f"    Connection error: {e}")
            print("    Is the llama.cpp server still running?")
            return None
        except Exception as e:
            print(f"    Error on attempt {attempt + 1}/{max_retries}: {e}")
            if attempt < max_retries - 1:
                print("    Retrying in 3 seconds...")
                time.sleep(3)
                continue
    
    print("    Failed after all retry attempts")
    return None

def extract_answer_letter(response_text):
    """Extract A, B, C, or D from the response with multiple methods."""
    if not response_text:
        print("    No response text to parse")
        return None
    
    print(f"    Parsing response: '{response_text[:100]}...'")
    
    # Method 1: Look for standalone letters at the beginning
    match = re.match(r'^([ABCD])\b', response_text.strip(), re.IGNORECASE)
    if match:
        letter = match.group(1).upper()
        print(f"    Found letter at start: {letter}")
        return letter
    
    # Method 2: Look for "Answer: X" or similar patterns
    patterns = [
        r'(?:answer|response):\s*([ABCD])\b',
        r'(?:the\s+)?(?:correct\s+)?answer\s+is\s+([ABCD])\b',
        r'(?:i\s+choose\s+|i\s+select\s+)([ABCD])\b',
        r'\b([ABCD])\s*(?:is\s+correct|is\s+the\s+answer)',
    ]
    
    for i, pattern in enumerate(patterns):
        match = re.search(pattern, response_text, re.IGNORECASE)
        if match:
            letter = match.group(1).upper()
            print(f"    Found letter with pattern {i+1}: {letter}")
            return letter
    
    # Method 3: Look for any A, B, C, or D in the response
    letters = re.findall(r'\b([ABCD])\b', response_text, re.IGNORECASE)
    if letters:
        letter = letters[0].upper()
        print(f"    Found first letter in text: {letter}")
        return letter
    
    # Method 4: Look for lowercase letters
    letters = re.findall(r'\b([abcd])\b', response_text)
    if letters:
        letter = letters[0].upper()
        print(f"    Found lowercase letter: {letter}")
        return letter
    
    print("    Could not extract any letter from response")
    return None

def get_model_answer(question, options, model_name):
    """Get the model's answer to a multiple-choice question."""
    prompt = f"""You are a medical expert specializing in diabetes. Answer this multiple-choice question about diabetes.

Select the most accurate answer from the options provided.
Give your response and then your explanation.
Example:
Question: What is the normal range for fasting blood sugar?
A: 50-70 mg/dL
B: 70-100 mg/dL
C: 100-125 mg/dL
D: Above 126 mg/dL

Correct response: B, Explanation: ....

Now answer this question:
Question: {question}

A: {options['A']}
B: {options['B']}
C: {options['C']}
D: {options['D']}

Your answer:"""
    
    print(f"    Sending prompt to model...")
    response = call_local_llama(prompt, model_name)
    
    if not response:
        print("    No response from model")
        return None
    
    # Extract the letter from response
    letter = extract_answer_letter(response)
    if letter:
        print(f"    Extracted answer: {letter}")
    else:
        print("    Failed to extract letter from response")
    
    return letter

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

def benchmark_model(model_name="local-gguf"):
    """Run benchmark on the specified model using the diabetes QA dataset."""
    try:
        # Test connection to local server
        try:
            print("Testing connection to llama.cpp server...")
            test_response = requests.get(f"{LLAMA_CPP_SERVER_URL}/health", timeout=10)
            print("✓ Connected to local llama.cpp server")
        except Exception as e:
            print(f"✗ Cannot connect to local llama.cpp server: {e}")
            print("Make sure it's running on http://127.0.0.1:8081")
            return
        
        # Read the CSV file
        print(f"Reading CSV file: {INPUT_CSV}")
        df = pd.read_csv(INPUT_CSV)
        print(f"Found {len(df)} questions")
        
        # Load correct answers for evaluation
        print(f"Loading correct answers: {CORRECT_ANSWERS_JSON}")
        with open(CORRECT_ANSWERS_JSON, 'r', encoding='utf-8') as f:
            correct_answers = json.load(f)
        print(f"Loaded {len(correct_answers)} correct answers")
        
        # Create a dictionary to store the model's answers
        model_answers = {}
        
        # Generate timestamp for the output file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name_safe = model_name.replace('/', '_')
        output_json = OUTPUT_DIR / f"benchmark_{model_name_safe}_{timestamp}.json"
        print(f"Results will be saved to: {output_json}")
        
        # Process each row
        total = len(df)
        start_time = time.time()
        successful_answers = 0
        
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
            
            print(f"\n" + "="*80)
            print(f"Processing {index + 1}/{total}: Question {question_id}")
            print(f"Question: {question}")
            print(f"A: {options['A']}")
            print(f"B: {options['B']}")
            print(f"C: {options['C']}")
            print(f"D: {options['D']}")
            print(f"Correct answer: {correct_answers[question_id]}")
            
            # Get model's answer
            try:
                model_answer = get_model_answer(question, options, model_name)
                
                if model_answer:
                    model_answers[question_id] = model_answer
                    successful_answers += 1
                    print(f"✓ Model answered: {model_answer}")
                    
                    # Save progress after each successful question
                    progress_data = {
                        "model": model_name,
                        "timestamp": timestamp,
                        "answers": model_answers,
                        "progress": f"{successful_answers}/{total}",
                        "processing_time_seconds": time.time() - start_time
                    }
                    
                    with open(output_json, 'w', encoding='utf-8') as f:
                        json.dump(progress_data, f, indent=4, ensure_ascii=False)
                else:
                    print(f"✗ Failed to get answer for question {question_id}")
                
                # Longer delay between questions to avoid overwhelming the local server
                print("    Waiting 2 seconds before next question...")
                time.sleep(5)
                
            except Exception as e:
                print(f"✗ Error processing question {question_id}: {e}")
                # Save progress even if there was an error
                progress_data = {
                    "model": model_name,
                    "timestamp": timestamp,
                    "answers": model_answers,
                    "progress": f"{successful_answers}/{total}",
                    "processing_time_seconds": time.time() - start_time
                }
                with open(output_json, 'w', encoding='utf-8') as f:
                    json.dump(progress_data, f, indent=4, ensure_ascii=False)
        
        # Calculate and save evaluation metrics
        end_time = time.time()
        evaluation = evaluate_model(model_answers, correct_answers)
        
        results = {
            "model": model_name,
            "timestamp": timestamp,
            "answers": model_answers,
            "evaluation": evaluation,
            "processing_time_seconds": end_time - start_time,
            "successful_responses": successful_answers,
            "total_questions": total,
            "success_rate": (successful_answers / total) * 100 if total > 0 else 0
        }
        
        # Save final results
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=4, ensure_ascii=False)
        
        print(f"\n" + "="*80)
        print(f"BENCHMARKING COMPLETE!")
        print(f"Results saved to: {output_json}")
        print(f"Success rate: {results['success_rate']:.1f}% ({successful_answers}/{total} questions answered)")
        print(f"Accuracy: {evaluation['accuracy']:.2f}% ({evaluation['correct_answers']}/{evaluation['total_questions']} correct)")
        print(f"Total processing time: {end_time - start_time:.2f} seconds")
        
    except Exception as e:
        print(f"Error during benchmarking: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Benchmark a local GGUF model on the diabetes QA dataset.')
    parser.add_argument('--model_name', default='local-gguf', help='The name to use for the model in results (default: local-gguf)')
    
    args = parser.parse_args()
    
    print(f"Starting benchmarking with local model: {args.model_name}")
    benchmark_model(args.model_name)