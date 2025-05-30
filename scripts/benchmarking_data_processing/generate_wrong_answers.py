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
INPUT_CSV = Path(r"c:\Users\Asus\Desktop\Diabot-PFA-Project\Benchmarking-QA-Diabetes.csv")
OUTPUT_DIR = Path(r"c:\Users\Asus\Desktop\Diabot-PFA-Project\Benchmarking-QA-Datasets")
OUTPUT_CSV = OUTPUT_DIR / "Benchmarking-QA-Diabetes-With-Wrong-Answers.csv"

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def call_openrouter(prompt):
    """Call OpenRouter API to generate wrong answers."""
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
        "temperature": 0.8,  # Slightly higher temperature for more creative wrong answers
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
        return None

def generate_wrong_answers(question, correct_answer):
    """Generate three incorrect answers for the given question and correct answer."""
    prompt = f"""You are a medical expert creating a multiple-choice quiz about diabetes. 
    For the following question and its correct answer, please generate three incorrect but plausible answers 
    that a person with limited medical knowledge might think are correct. The answers should be concise 
    (1-2 sentences max) and clearly wrong to a medical professional but plausible to a layperson.

    QUESTION: {question}
    
    CORRECT ANSWER: {correct_answer}
    
    Please provide exactly three incorrect answers, one per line, in the following format:
    1. [First wrong answer]
    2. [Second wrong answer]
    3. [Third wrong answer]"""
    
    response = call_openrouter(prompt)
    if not response:
        return ["Error generating answer 1", "Error generating answer 2", "Error generating answer 3"]
    
    # Parse the response to extract the three answers
    lines = [line.strip() for line in response.split('\n') if line.strip()]
    answers = []
    
    for line in lines[:3]:  # Take at most 3 answers
        # Remove numbering if present (e.g., "1. " or "1) ")
        if '. ' in line[:3]:
            answer = line.split('. ', 1)[1] if len(line.split('. ', 1)) > 1 else line
        elif ') ' in line[:3]:
            answer = line.split(') ', 1)[1] if len(line.split(') ', 1)) > 1 else line
        else:
            answer = line
        answers.append(answer)
    
    # Ensure we have exactly 3 answers
    while len(answers) < 3:
        answers.append(f"Error generating answer {len(answers) + 1}")
    
    return answers[:3]

def process_csv():
    """Process the CSV file and generate wrong answers for each question."""
    # Read the CSV file
    try:
        df = pd.read_csv(INPUT_CSV, encoding='utf-8')
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        return
    
    # Clean up the dataframe
    # Remove empty columns
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    df = df.dropna(axis=1, how='all')
    
    # Rename columns for consistency
    df = df.rename(columns={"Q": "Question"})
    
    # Add columns for wrong answers if they don't exist
    for i in range(1, 4):
        if f'Wrong_Answer_{i}' not in df.columns:
            df[f'Wrong_Answer_{i}'] = ''
    
    # Process each row
    total = len(df)
    for index, row in df.iterrows():
        question = row.get('Question', '')
        answer = row.get('A', '')
        
        if not question or not answer:
            print(f"Skipping row {index + 1} - missing question or answer")
            continue
        
        print(f"\nProcessing {index + 1}/{total}: {question[:50]}...")
        
        # Skip if we already have wrong answers
        if all(row.get(f'Wrong_Answer_{i}') for i in range(1, 4)):
            print("  Already processed, skipping...")
            continue
        
        # Generate wrong answers
        try:
            wrong_answers = generate_wrong_answers(question, answer)
            
            # Update the dataframe with the wrong answers
            for i in range(3):
                df.at[index, f'Wrong_Answer_{i+1}'] = wrong_answers[i]
            
            # Save progress after each row
            df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')
            print(f"  Generated answers for: {question[:50]}...")
            
            # Add a small delay to avoid rate limiting
            time.sleep(1)
            
        except Exception as e:
            print(f"  Error processing row {index + 1}: {e}")
            # Save progress even if there was an error
            df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')
    
    # Final save
    df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')
    print(f"\nProcessing complete! Results saved to: {OUTPUT_CSV}")

if __name__ == "__main__":
    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY not found in environment variables.")
        print("Please set the OPENROUTER_API_KEY in your .env file.")
    else:
        print(f"Starting processing with model: {MODEL_NAME}")
        process_csv()
