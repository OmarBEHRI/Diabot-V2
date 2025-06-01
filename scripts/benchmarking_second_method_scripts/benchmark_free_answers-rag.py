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
import sys

# Load environment variables from .env file
load_dotenv()

# Configuration
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')

# Get the project root directory (two levels up from this script)
PROJECT_ROOT = Path(__file__).parent.parent.parent
INPUT_CSV = PROJECT_ROOT / "Benchmarking" / "Datasets" / "refference-answers" / "Diabetes_QA_Questions_Answers.csv"
OUTPUT_DIR = PROJECT_ROOT / "Benchmarking" / "Second-Method-Results"
RAG_OUTPUT_DIR = OUTPUT_DIR / "rag"
EVALUATOR_MODEL = "google/gemini-2.5-flash-preview-05-20"

# Ensure output directories exist
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
RAG_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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
        "max_tokens": 500
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

import os
import requests
from dotenv import load_dotenv

# --- Authentication helper ---
def get_jwt_token(username, password, api_base_url):
    """Authenticate with the backend and return a JWT token."""
    login_url = f"{api_base_url}/api/auth/login"
    payload = {"username": username, "password": password}
    try:
        resp = requests.post(login_url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        token = data.get("token")
        if not token:
            print("Error: No token returned from login.")
            return None
        return token
    except Exception as e:
        print(f"Error logging in: {e}")
        return None

# --- RAG context retrieval for benchmarking ---
def get_rag_context(question, api_base_url="http://localhost:8090", jwt_token=None, n_results=3, include_adjacent=False):
    """Get RAG context and sources for a question via backend API."""
    headers = {"Authorization": f"Bearer {jwt_token}"} if jwt_token else {}
    url = f"{api_base_url}/api/rag/get_sources"
    payload = {
        "question": question,
        "n_results": n_results,
        "include_adjacent": include_adjacent
    }
    try:
        resp = requests.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data.get("context"), data.get("sources")
    except Exception as e:
        print(f"Error retrieving RAG context: {e}")
        return None, None

# --- Model answer using OpenRouter with RAG context ---
def get_model_answer(question, context, model_name, api_key=None):
    """Call OpenRouter API to get the model's answer given RAG context and question."""
    if not api_key:
        api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        raise ValueError("OpenRouter API key not found in environment variables")
    prompt = f"""Given the following medical context, answer the user's question as accurately and helpfully as possible.\n\nContext:\n{context}\n\nQuestion:\n{question}\n"""
    # print("\n===== PROMPT SENT TO MODEL =====\n" + prompt + "\n===============================\n")  # Commented for minimal output
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Diabot Medical Assistant"
    }
    data = {
        "model": model_name,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 500
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

def evaluate_answer(question, reference_answer, model_answer):
    """Use Gemini to evaluate the model's answer against the reference answer."""
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

def benchmark_model(model_name):
    """Run benchmark on the specified model using the diabetes QA dataset."""
    try:
        # Read the CSV file
        df = pd.read_csv(INPUT_CSV)
        if hasattr(args, 'test') and args.test:
            df = df.head(10)
        
        # Create a dictionary to store the model's answers and evaluations
        results = {
            "model": model_name,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "questions": {}
        }
        
        # Generate timestamp for the output file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name_safe = model_name.replace('/', '_')
        output_json = RAG_OUTPUT_DIR / f"benchmark_free_rag_{model_name_safe}_{timestamp}.json"
        
        # Process each row
        total = len(df)
        start_time = time.time()
        
        def print_progress(current, total, bar_length=30):
            percent = float(current) / total
            arrow = '#' * int(round(percent * bar_length))
            spaces = '.' * (bar_length - len(arrow))
            sys.stdout.write(f'\rProgress: [{arrow}{spaces}] {current}/{total}')
            sys.stdout.flush()

        for index, row in df.iterrows():
            question_id = str(row['id'])
            question = row['Question']
            reference_answer = row['Answer']

            # Get RAG context
            context, sources = get_rag_context(question, api_base_url=args.api_base_url, jwt_token=jwt_token, n_results=3)
            if not context:
                sys.stdout.write(f"\n[ERROR: No RAG context found for question {question_id}]")
                sys.stdout.flush()
                continue

            # Get model's answer
            try:
                model_answer = get_model_answer(question, context, model_name)

                if model_answer:
                    # Evaluate the answer
                    evaluation = evaluate_answer(question, reference_answer, model_answer)

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
                # else: fail silently, just skip

                print_progress(index + 1, total)
                time.sleep(1)

            except Exception as e:
                sys.stdout.write(f"\n[Error processing question {question_id}: {e}]")
                sys.stdout.flush()
                # Save progress even if there was an error
                with open(output_json, 'w', encoding='utf-8') as f:
                    json.dump(results, f, indent=4, ensure_ascii=False)
        sys.stdout.write('\n')
        sys.stdout.flush()
 
        # Calculate and save final metrics
        end_time = time.time()
        results["processing_time_seconds"] = end_time - start_time

        # Calculate accuracy
        correct = sum(q["binary_correct"] for q in results["questions"].values())
        total = len(results["questions"])
        results["accuracy"] = correct / total if total > 0 else 0.0

        # Save final results
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=4, ensure_ascii=False)

        print(f"\nBenchmarking complete! Results saved to: {output_json}")
        print(f"Total processing time: {end_time - start_time:.2f} seconds")

    except Exception as e:
        print(f"Error during benchmarking: {e}")

if __name__ == "__main__":
    import argparse
    load_dotenv()
    parser = argparse.ArgumentParser(description='Benchmark all models using RAG-augmented answers via backend API.')
    parser.add_argument('--api_base_url', type=str, default='http://localhost:8090', help='Base URL of the backend API (default: http://localhost:8090)')
    parser.add_argument('--topic_id', type=int, default=1, help='Topic ID for diabetes (default: 1)')
    parser.add_argument('--username', type=str, default=os.getenv('DIABOT_USERNAME'), help='Backend username (or set DIABOT_USERNAME env var)')
    parser.add_argument('--password', type=str, default=os.getenv('DIABOT_PASSWORD'), help='Backend password (or set DIABOT_PASSWORD env var)')
    parser.add_argument('--test', action='store_true', help='Test mode: only run first model and first 10 questions')
    parser.add_argument('--model_name', type=str, default=None, help='Run only the specified model (exact OpenRouter model name)')
    args = parser.parse_args()

    if not args.username or not args.password:
        print("Error: Username and password required (set via --username/--password or DIABOT_USERNAME/DIABOT_PASSWORD env vars)")
        exit(1)

    # Authenticate and get JWT token
    jwt_token = get_jwt_token(args.username, args.password, args.api_base_url)
    if not jwt_token:
        print("Error: Could not authenticate with backend. Check username/password/API URL.")
        exit(1)

    # List of OpenRouter model names to benchmark, in desired order
    model_names = [
        "qwen/qwen-2.5-7b-instruct",
        "openai/gpt-4.1-mini",
        "mistralai/mistral-nemo",
        "meta-llama/llama-4-scout",
        "meta-llama/llama-3.1-8b-instruct",
        "google/gemma-3-4b-it",
        "google/gemini-2.5-flash-preview-05-20",
        "google/gemini-2.0-flash-001"
    ]

    # If model_name is specified, run only that model
    if args.model_name:
        if args.model_name not in model_names:
            print(f"Error: Model name '{args.model_name}' not found in model_names list.")
            exit(1)
        model_names = [args.model_name]

    # Load dataset
    df = pd.read_csv(INPUT_CSV)
    if args.test:
        print("\n[TEST MODE] Only running first model and first 10 questions.\n")
        model_names = [model_names[0]]
        df = df.head(10)

    for model_name in model_names:
        print(f"\n===== Benchmarking Model: {model_name} =====\n")
        benchmark_model(model_name)
        if args.test:
            print("\n[TEST MODE] Finished test run.\n")
            break
