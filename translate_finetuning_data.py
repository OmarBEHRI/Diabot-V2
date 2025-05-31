import os
import sys
import time
import json
import pandas as pd
import requests
from pathlib import Path
from tqdm import tqdm
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Utility print functions (matching style from process_summaries.py)
def print_step(message):
    print(f"\n{'='*50}")
    print(f"{message}")
    print(f"{'='*50}")

def print_info(message):
    print(f"[INFO] {message}")

def print_error(message):
    print(f"[ERROR] {message}")

def print_warning(message):
    print(f"[WARNING] {message}")

def print_success(message):
    print(f"[SUCCESS] {message}")

class FinetuningDataTranslator:
    def __init__(self, input_csv, output_csv, output_instruction, output_chat):
        self.input_csv = input_csv
        self.output_csv = output_csv
        self.output_instruction = output_instruction
        self.output_chat = output_chat
        self.api_key = os.getenv('OPENROUTER_API_KEY')
        self.model = "google/gemini-2.5-flash-preview"
        
        if not self.api_key:
            print_error("OpenRouter API key not found in environment variables.")
            print_info("Please set the OPENROUTER_API_KEY environment variable.")
            sys.exit(1)
        
        print_info(f"Using model: {self.model}")
        print_info(f"Input CSV: {self.input_csv}")
        print_info(f"Output CSV: {self.output_csv}")
        print_info(f"Output Instruction JSONL: {self.output_instruction}")
        print_info(f"Output Chat JSONL: {self.output_chat}")
    
    def translate_text(self, text, source_lang="fr", target_lang="en"):
        """Translate text using OpenRouter API with Gemini 2.5 Flash."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Diabot Medical Assistant"
        }
        
        system_prompt = f"You are a professional translator. Translate the following text from {source_lang} to {target_lang}. Maintain the original meaning, tone, and formatting. Preserve markdown formatting. Do not add or remove information. Return only the translated text without any additional comments or explanations."
        
        data = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            "temperature": 0.1  # Low temperature for more consistent translations
        }
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=data
                )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"].strip()
            except Exception as e:
                if attempt == max_retries - 1:
                    print_error(f"Translation error after {max_retries} attempts: {e}")
                    return None
                print_warning(f"Translation attempt {attempt+1} failed: {e}. Retrying...")
                time.sleep(2)  # Wait before retry
    
    def clean_answer(self, answer):
        """Remove 'Answer:' prefix if it exists."""
        if isinstance(answer, str):
            if answer.startswith("Answer:"):
                return answer[len("Answer:"):].strip()
            if answer.startswith("Réponse:"):
                return answer[len("Réponse:"):].strip()
        return answer
    
    def translate_dataset(self, batch_size=2):
        """Translate the dataset from French to English."""
        print_step("Loading and translating finetuning dataset")
        
        # Load the dataset
        try:
            df = pd.read_csv(self.input_csv)
            print_info(f"Loaded {len(df)} rows from {self.input_csv}")
        except Exception as e:
            print_error(f"Error loading CSV: {e}")
            return None
        
        # Create new columns for translated content
        df['question_english'] = ''
        df['model_answer_english'] = ''
        
        # Process in batches to avoid API rate limits
        total_rows = len(df)
        for i in tqdm(range(0, total_rows, batch_size), desc="Translating batches"):
            batch_end = min(i + batch_size, total_rows)
            batch_df = df.iloc[i:batch_end]
            
            # Translate questions
            for idx in batch_df.index:
                question = df.at[idx, 'question']
                print_info(f"Translating question {idx+1}/{total_rows}: {question[:50]}...")
                
                translated = self.translate_text(question)
                if translated:
                    df.at[idx, 'question_english'] = translated
                    # Save progress after each translation
                    df.to_csv(self.output_csv, index=False)
                time.sleep(1)  # Add delay to avoid rate limits
            
            # Translate answers
            for idx in batch_df.index:
                answer = df.at[idx, 'model_answer']
                print_info(f"Translating answer {idx+1}/{total_rows}: {answer[:50]}...")
                
                translated = self.translate_text(answer)
                if translated:
                    # Clean the answer by removing "Answer:" prefix
                    cleaned = self.clean_answer(translated)
                    df.at[idx, 'model_answer_english'] = cleaned
                    # Save progress after each translation
                    df.to_csv(self.output_csv, index=False)
                time.sleep(1)  # Add delay to avoid rate limits
        
        # Create final dataframe with English content
        english_df = df[['question_id', 'question_english', 'model_answer_english']].copy()
        english_df.columns = ['question_id', 'question', 'model_answer']
        
        # Save final English dataset
        print_info(f"Writing final English dataset to {self.output_csv}")
        english_df.to_csv(self.output_csv, index=False)
        print_success(f"Translation complete! {len(english_df)} rows translated and saved.")
        
        return english_df
    
    def convert_to_instruction_format(self, df):
        """Convert the dataset to instruction format with prompt and completion fields."""
        print_step("Converting to instruction format")
        
        # Create instruction format data
        instruction_data = []
        for _, row in df.iterrows():
            instruction_data.append({
                "prompt": row['question'],
                "completion": row['model_answer']
            })
        
        # Save to JSONL file
        with open(self.output_instruction, 'w', encoding='utf-8') as f:
            for item in instruction_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        print_success(f"Conversion complete! {len(instruction_data)} rows converted to instruction format.")
    
    def convert_to_chat_format(self, df):
        """Convert the dataset to chat format with messages field."""
        print_step("Converting to chat format")
        
        # Create chat format data
        chat_data = []
        for _, row in df.iterrows():
            chat_data.append({
                "messages": [
                    {"role": "user", "content": row['question']},
                    {"role": "assistant", "content": row['model_answer']}
                ]
            })
        
        # Save to JSONL file
        with open(self.output_chat, 'w', encoding='utf-8') as f:
            for item in chat_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        print_success(f"Conversion complete! {len(chat_data)} rows converted to chat format.")
    
    def process(self):
        """Process the finetuning dataset: translate, clean, and convert to different formats."""
        try:
            # Translate dataset
            english_df = self.translate_dataset()
            if english_df is None:
                return
            
            # Convert to instruction format
            self.convert_to_instruction_format(english_df)
            
            # Convert to chat format
            self.convert_to_chat_format(english_df)
            
            print_step("All processing complete!")
            print_info(f"1. Translated CSV: {self.output_csv}")
            print_info(f"2. Instruction Format: {self.output_instruction}")
            print_info(f"3. Chat Format: {self.output_chat}")
            print_info("\nYou can now use these files for finetuning your model.")
            
        except KeyboardInterrupt:
            print_warning("\nOperation cancelled by user.")
        except Exception as e:
            print_error(f"\nError during processing: {e}")

if __name__ == "__main__":
    # Define file paths
    input_csv = Path(r"c:\Users\Usuario\OneDrive\Desktop\Diabot-V2\finetuning_data.csv")
    output_csv = Path(r"c:\Users\Usuario\OneDrive\Desktop\Diabot-V2\finetuning_data_english.csv")
    output_instruction = Path(r"c:\Users\Usuario\OneDrive\Desktop\Diabot-V2\finetuning_data_instruction.jsonl")
    output_chat = Path(r"c:\Users\Usuario\OneDrive\Desktop\Diabot-V2\finetuning_data_chat.jsonl")
    
    # Create and run the translator
    translator = FinetuningDataTranslator(input_csv, output_csv, output_instruction, output_chat)
    translator.process()
