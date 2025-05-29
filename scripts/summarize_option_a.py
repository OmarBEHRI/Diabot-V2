import os
import csv
import time
import json
import pandas as pd
from dotenv import load_dotenv
import requests
from pathlib import Path

# Load environment variables from .env file
load_dotenv()

# Configuration
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
MODEL_NAME = "google/gemini-2.5-flash-preview"
INPUT_CSV = Path(r"c:\Users\Usuario\OneDrive\Desktop\PFA\Diabot-V2\Benchmarking-QA-Datasets\Benchmarking-QA-Diabetes-With-Wrong-Answers.csv")
OUTPUT_DIR = Path(r"c:\Users\Usuario\OneDrive\Desktop\PFA\Diabot-V2\Benchmarking-QA-Datasets")
OUTPUT_CSV = OUTPUT_DIR / "Diabetes_QA_With_Summarized_A.csv"

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def call_openrouter(prompt):
    """Call OpenRouter API to generate summarized answers."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OpenRouter API key not found in environment variables")
    
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Diabot Medical Assistant"
    }
    
    data = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.3,  # Lower temperature for more consistent summaries
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

def summarize_answer(question, answer):
    """Summarize the correct answer for the given question."""
    prompt = f"""You are a medical expert specializing in diabetes. Your task is to summarize the following correct answer 
    to a diabetes-related question. The summary should be concise (1-2 sentences, maximum 200 characters) 
    while preserving the key medical information and accuracy. The summary should be clear and helpful for patients.
    
    QUESTION: {question}
    
    FULL ANSWER: {answer}
    
    Please provide only the summarized answer without any additional text or explanation. 
    Keep it under 200 characters if possible."""
    
    response = call_openrouter(prompt)
    if not response:
        return answer[:200] + "..." if len(answer) > 200 else answer
    
    # Ensure the summary is not too long
    if len(response) > 200:
        response = response[:197] + "..."
    
    return response

def process_csv():
    """Process the CSV file and generate summarized answers for each question."""
    # Read the CSV file
    try:
        df = pd.read_csv(INPUT_CSV, encoding='utf-8')
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        return
    
    # Create a copy of the dataframe for summarized answers
    summarized_df = df.copy()
    
    # Process each row
    total = len(df)
    for index, row in df.iterrows():
        question = row.get('Question', '')
        answer = row.get('A', '')
        
        if not question or not answer:
            print(f"Skipping row {index + 1} - missing question or answer")
            continue
        
        print(f"\nProcessing {index + 1}/{total}: {question[:50]}...")
        
        # Summarize the answer
        try:
            summarized_answer = summarize_answer(question, answer)
            
            # Update the dataframe with the summarized answer
            summarized_df.at[index, 'A'] = summarized_answer
            
            # Save progress after each row
            summarized_df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')
            print(f"  Summarized answer for: {question[:50]}...")
            
            # Add a small delay to avoid rate limiting
            time.sleep(1)
            
        except Exception as e:
            print(f"  Error processing row {index + 1}: {e}")
            # Save progress even if there was an error
            summarized_df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')
    
    # Final save
    summarized_df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')
    print(f"\nProcessing complete! Results saved to: {OUTPUT_CSV}")

if __name__ == "__main__":
    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY not found in environment variables.")
        print("Please set the OPENROUTER_API_KEY in your .env file.")
    else:
        print(f"Starting processing with model: {MODEL_NAME}")
        process_csv()
