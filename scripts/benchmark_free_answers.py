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
INPUT_CSV = Path(r"c:\\Users\\Usuario\\OneDrive\\Desktop\\PFA\\Diabot-V2\\Benchmarking-QA-Datasets\\Diabetes_QA_Questions_Answers.csv")
OUTPUT_DIR = Path(r"c:\\Users\\Usuario\\OneDrive\\Desktop\\PFA\\Diabot-V2\\Benchmarking-QA-Datasets\\Benchmark_Results")
EVALUATOR_MODEL = "google/gemini-2.5-flash-preview-05-20"

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

def get_model_answer(question, model_name):
    """Get the model's free-form answer to a question."""
    prompt = f"""You are a medical expert specializing in diabetes. Please answer the following question about diabetes.
    Provide a clear, accurate, and concise answer based on medical facts. Your answer should be helpful for a patient 
    with diabetes who needs reliable information.
    
    Example:
    Question: What is the normal range for fasting blood sugar?
    Answer: The normal range for fasting blood sugar is 70-100 mg/dL (3.9-5.6 mmol/L). 
    This is the blood glucose level after not eating for at least 8 hours.
    
    Now answer this question:
    Question: {question}
    
    Your answer (be specific and factual):"""
    
    response = call_openrouter(prompt, model_name)
    return response

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
                    
                    # Evaluate the answer
                    evaluation = evaluate_answer(question, reference_answer, model_answer)
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
                
                # Add a small delay to avoid rate limiting
                time.sleep(1)
                
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
    parser = argparse.ArgumentParser(description='Benchmark an OpenRouter model on the diabetes QA dataset with free-form answers.')
    parser.add_argument('model_name', help='The name of the model to benchmark (e.g., "google/gemini-2.5-flash-preview")')
    
    args = parser.parse_args()
    
    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY not found in environment variables.")
        print("Please set the OPENROUTER_API_KEY in your .env file.")
    else:
        print(f"Starting benchmarking with model: {args.model_name}")
        benchmark_model(args.model_name)
