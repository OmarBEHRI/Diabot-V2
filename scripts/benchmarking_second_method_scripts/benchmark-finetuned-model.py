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

# Configuration - Modified for local llama.cpp server
LLAMA_CPP_SERVER_URL = "http://127.0.0.1:8081"
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')  # Still needed for evaluator

# Get the project root directory (two levels up from this script)
PROJECT_ROOT = Path(__file__).parent.parent.parent
INPUT_CSV = PROJECT_ROOT / "Benchmarking" / "Datasets" / "refference-answers" / "Diabetes_QA_Questions_Answers.csv"
OUTPUT_DIR = PROJECT_ROOT / "Benchmarking" / "Second-Method-Results"
EVALUATOR_MODEL = "google/gemini-2.5-flash-preview-05-20"

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def call_local_llama(prompt, model_name="local-gguf"):
    """Call local llama.cpp server to get model's answer."""
    
    headers = {
        "Content-Type": "application/json"
    }
    
    data = {
        "prompt": prompt,
        "temperature": 0.1,
        "n_predict": 500,
        "stop": ["\n\nQuestion:", "\n\nAnswer:", "Question:", "\n---"]
    }
    
    try:
        response = requests.post(
            f"{LLAMA_CPP_SERVER_URL}/completion",
            headers=headers,
            json=data
        )
        response.raise_for_status()
        return response.json()["content"].strip()
    except Exception as e:
        print(f"Error calling local llama.cpp server: {e}")
        return None

def call_openrouter(prompt, model_name):
    """Call OpenRouter API to get evaluator's response."""
    if not OPENROUTER_API_KEY:
        print("Warning: No OpenRouter API key found. Evaluation will be skipped.")
        return "Evaluation skipped - no API key"
    
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
        "temperature": 0.1,
        "max_tokens": 1000
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
        return f"Evaluation error: {e}"

def get_model_answer(question, model_name):
    """Get the model's free-form answer to a question."""
    prompt = f"""
Answer this question:
Question: {question}

Your answer:"""
    
    response = call_local_llama(prompt, model_name)
    return response

def evaluate_answer(question, reference_answer, model_answer):
    """Use Gemini to evaluate the model's answer against the reference answer."""
    if not OPENROUTER_API_KEY:
        return "Evaluation skipped - no OpenRouter API key"
        
    prompt = f"""You are a medical expert specializing in diabetes. You are evaluating the quality of an AI's answer 
to a diabetes-related question. Compare the AI's answer to a reference answer provided by medical professionals.

Question: {question}

Reference Answer: {reference_answer}

AI's Answer: {model_answer}

Evaluate the AI's answer on the following criteria:
1. Medical Accuracy (0-10): Is the information medically correct and aligned with current medical knowledge?
2. Completeness (0-10): Does it address all important aspects of the question?
3. Clarity (0-10): Is the answer clear and easy to understand?
4. Helpfulness (0-10): Would this answer be helpful to a patient with diabetes?
5. Binary Correctness (1 or 0): Based on medical accuracy and completeness, is the answer essentially correct? 
   Give 1 if the answer is medically correct and complete, 0 if it's incorrect or missing critical information.

For each criterion, provide a score and a brief explanation.

Format your response as:
Medical Accuracy: [score] - [explanation]
Completeness: [score] - [explanation]
Clarity: [score] - [explanation]
Helpfulness: [score] - [explanation]
Binary Correctness: [1 or 0] - [brief explanation]

Example:
Medical Accuracy: 9 - The answer is mostly accurate but slightly oversimplifies the mechanism.
Completeness: 8 - Covers the main points but misses one important consideration.
Clarity: 10 - Very clear and well-structured response.
Helpfulness: 9 - Would be very helpful to a patient.
Binary Correctness: 1 - The answer is essentially correct despite minor omissions."""
    
    response = call_openrouter(prompt, EVALUATOR_MODEL)
    return response

def benchmark_model(model_name="local-gguf"):
    """Run benchmark on the specified model using the diabetes QA dataset."""
    try:
        # Test connection to local server
        try:
            test_response = requests.get(f"{LLAMA_CPP_SERVER_URL}/health")
            print("✓ Connected to local llama.cpp server")
        except:
            print("✗ Cannot connect to local llama.cpp server. Make sure it's running on http://127.0.0.1:8081")
            return
        
        # Read the CSV file
        df = pd.read_csv(INPUT_CSV)
        
        # Create a dictionary to store the model's answers and evaluations
        results = {
            "model": model_name,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "questions": {}
        }
        
        # Generate timestamp for the output file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name_safe = model_name.replace('/', '_')
        output_json = OUTPUT_DIR / f"benchmark_free_{model_name_safe}_{timestamp}.json"
        
        # Process each row
        total = len(df)
        start_time = time.time()
        
        for index, row in df.iterrows():
            question_id = str(row['id'])
            question = row['Question']
            reference_answer = row['Answer']
            
            print(f"\nProcessing {index + 1}/{total}: Question {question_id}")
            print(f"Question: {question[:100]}...")
            
            # Get model's answer
            try:
                model_answer = get_model_answer(question, model_name)
                
                if model_answer:
                    print(f"  Model's answer: {model_answer[:100]}...")
                    
                    # Evaluate the answer (if API key available)
                    evaluation = evaluate_answer(question, reference_answer, model_answer)
                    if evaluation.startswith("Evaluation skipped"):
                        print(f"  {evaluation}")
                        binary_correct = 0  # Default when can't evaluate
                    else:
                        print(f"  Evaluation: {evaluation[:100]}...")
                        
                        # Parse the evaluation to extract binary correctness
                        binary_correct = 0
                        for line in evaluation.split('\n'):
                            if line.lower().startswith('binary correctness'):
                                binary_correct = 1 if '1' in line.split(':')[1] else 0
                                break
                    
                    # Store the results
                    results["questions"][question_id] = {
                        "question": question,
                        "reference_answer": reference_answer,
                        "model_answer": model_answer,
                        "evaluation": evaluation,
                        "binary_correct": binary_correct
                    }
                    
                    # Save progress after each question
                    with open(output_json, 'w', encoding='utf-8') as f:
                        json.dump(results, f, indent=4, ensure_ascii=False)
                else:
                    print(f"  Failed to get answer for question {question_id}")
                
                # Add a small delay between requests
                time.sleep(0.5)
                
            except Exception as e:
                print(f"  Error processing question {question_id}: {e}")
                # Save progress even if there was an error
                with open(output_json, 'w', encoding='utf-8') as f:
                    json.dump(results, f, indent=4, ensure_ascii=False)
        
        # Calculate and save final metrics
        end_time = time.time()
        results["processing_time_seconds"] = end_time - start_time
        
        # Save final results
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=4, ensure_ascii=False)
        
        print(f"\nBenchmarking complete! Results saved to: {output_json}")
        print(f"Total processing time: {end_time - start_time:.2f} seconds")
        
    except Exception as e:
        print(f"Error during benchmarking: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Benchmark a local GGUF model on the diabetes QA dataset with free-form answers.')
    parser.add_argument('--model_name', default='local-gguf', help='The name to use for the model in results (default: local-gguf)')
    
    args = parser.parse_args()
    
    print(f"Starting benchmarking with local model: {args.model_name}")
    benchmark_model(args.model_name)