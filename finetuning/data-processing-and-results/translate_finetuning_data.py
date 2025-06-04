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
    
    def translate_text(self, text, text_type="text"):
        """Translate text using OpenRouter API with Gemini 2.5 Flash."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Diabot Medical Assistant"
        }
        
        system_prompt = f"""You are a professional translator. Translate the following {text_type} to English. 
If it's already in English, output the same text or provide a paraphrased version that maintains the same meaning.
Maintain the original meaning, tone, and formatting. Preserve markdown formatting. 
Do not add or remove information. 
Return ONLY the direct translated content without any prefixes like 'The answer is:', 'To answer your question:', 'Here is the translation:', or any other introductory phrases.
Just provide the direct content."""
        
        data = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            "temperature": 0.1  # Low temperature for more consistent translations
        }
        
        print_info(f"📤 Sending to API - {text_type}:")
        print(f"   Original: {text[:100]}{'...' if len(text) > 100 else ''}")
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=data,
                    timeout=30
                )
                response.raise_for_status()
                raw_result = response.json()["choices"][0]["message"]["content"].strip()
                
                print_info(f"📥 Raw API Response:")
                print(f"   Raw: {raw_result[:200]}{'...' if len(raw_result) > 200 else ''}")
                
                # Additional cleaning to remove common prefixes
                result = self.clean_translation_response(raw_result)
                
                print_info(f"🧹 After Cleaning:")
                print(f"   Cleaned: {result[:200]}{'...' if len(result) > 200 else ''}")
                print("-" * 80)
                
                return result
                
            except requests.exceptions.RequestException as e:
                print_error(f"Request error on attempt {attempt+1}: {e}")
                if attempt == max_retries - 1:
                    print_error(f"Translation failed after {max_retries} attempts")
                    return None
                time.sleep(3)  # Longer wait on request errors
            except Exception as e:
                print_error(f"Unexpected error on attempt {attempt+1}: {e}")
                if attempt == max_retries - 1:
                    return None
                time.sleep(2)
    
    def clean_translation_response(self, text):
        """Remove common translation response prefixes and clean the response."""
        if not isinstance(text, str):
            return text
            
        # List of common prefixes to remove (case insensitive)
        prefixes_to_remove = [
            "Answer:",
            "Réponse:",
            "The answer is:",
            "To answer your question:",
            "Here is the translation:",
            "Translation:",
            "Traduction:",
            "The translation is:",
            "Here's the translation:",
            "The translated text is:",
            "English translation:",
            "In English:"
        ]
        
        text_clean = text.strip()
        
        for prefix in prefixes_to_remove:
            if text_clean.lower().startswith(prefix.lower()):
                text_clean = text_clean[len(prefix):].strip()
                break
        
        return text_clean
    
    def translate_dataset(self, batch_size=2, test_mode=False, max_test_rows=10):
        """Translate the dataset from French to English."""
        print_step("Loading and translating finetuning dataset")
        
        # Load the dataset
        try:
            df = pd.read_csv(self.input_csv)
            print_info(f"Loaded {len(df)} rows from {self.input_csv}")
            
            # Display first few rows for verification
            print_info("Sample of original data:")
            for i in range(min(3, len(df))):
                print(f"  Row {i+1} Question: {df.iloc[i]['question'][:80]}...")
                print(f"  Row {i+1} Answer: {df.iloc[i]['model_answer'][:80]}...")
            
            # If in test mode, only process a limited number of rows
            if test_mode:
                df = df.head(max_test_rows)
                print_warning(f"TEST MODE: Only processing first {max_test_rows} rows")
                
        except Exception as e:
            print_error(f"Error loading CSV: {e}")
            return None
        
        # Create new columns for translated content
        df['question_english'] = ''
        df['model_answer_english'] = ''
        
        # Process in batches to avoid API rate limits
        total_rows = len(df)
        successful_translations = 0
        failed_translations = 0
        
        for i in tqdm(range(0, total_rows, batch_size), desc="Translating batches"):
            batch_end = min(i + batch_size, total_rows)
            batch_df = df.iloc[i:batch_end]
            
            # Translate questions
            for idx in batch_df.index:
                question = df.at[idx, 'question']
                print_step(f"TRANSLATING QUESTION {idx+1}/{total_rows}")
                print_info(f"Original Question: {question}")
                
                translated = self.translate_text(question, "question")
                if translated:
                    df.at[idx, 'question_english'] = translated
                    successful_translations += 1
                    print_success(f"✅ QUESTION TRANSLATION SUCCESS")
                    print_info(f"Final Result: {translated}")
                else:
                    df.at[idx, 'question_english'] = question  # Keep original if translation fails
                    failed_translations += 1
                    print_warning(f"❌ Question translation failed, keeping original")
                
                # Save progress after each translation
                df.to_csv(self.output_csv, index=False)
                print_info(f"💾 Progress saved to {self.output_csv}")
                time.sleep(2)  # Increased delay to avoid rate limits
            
            # Translate answers
            for idx in batch_df.index:
                answer = df.at[idx, 'model_answer']
                print_step(f"TRANSLATING ANSWER {idx+1}/{total_rows}")
                print_info(f"Original Answer: {answer[:300]}{'...' if len(answer) > 300 else ''}")
                
                translated = self.translate_text(answer, "answer")
                if translated:
                    df.at[idx, 'model_answer_english'] = translated
                    successful_translations += 1
                    print_success(f"✅ ANSWER TRANSLATION SUCCESS")
                    print_info(f"Final Result: {translated[:300]}{'...' if len(translated) > 300 else ''}")
                else:
                    df.at[idx, 'model_answer_english'] = answer  # Keep original if translation fails
                    failed_translations += 1
                    print_warning(f"❌ Answer translation failed, keeping original")
                
                # Save progress after each translation
                df.to_csv(self.output_csv, index=False)
                print_info(f"💾 Progress saved to {self.output_csv}")
                time.sleep(2)  # Increased delay to avoid rate limits
        
        print_info(f"Translation Summary: {successful_translations} successful, {failed_translations} failed")
        
        # Create final dataframe with English content
        english_df = df[['question_id', 'question_english', 'model_answer_english']].copy()
        english_df.columns = ['question_id', 'question', 'model_answer']
        
        # Save final English dataset
        print_info(f"Writing final English dataset to {self.output_csv}")
        english_df.to_csv(self.output_csv, index=False)
        print_success(f"Translation complete! {len(english_df)} rows processed.")
        
        # Display sample of translated data
        print_step("FINAL TRANSLATION RESULTS SAMPLE")
        for i in range(min(3, len(english_df))):
            print_info(f"=== ENTRY {i+1} ===")
            print(f"Question: {english_df.iloc[i]['question']}")
            print(f"Answer: {english_df.iloc[i]['model_answer'][:500]}{'...' if len(english_df.iloc[i]['model_answer']) > 500 else ''}")
            print("-" * 100)
        
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
    
    def process(self, test_mode=False):
        """Process the finetuning dataset: translate, clean, and convert to different formats."""
        try:
            # Translate dataset
            english_df = self.translate_dataset(test_mode=test_mode, max_test_rows=10)
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
    import argparse
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Translate finetuning dataset from French to English")
    parser.add_argument("--test", action="store_true", help="Run in test mode with only 10 rows")
    args = parser.parse_args()
    
    # Define file paths
    input_csv = Path(r"c:\Users\Usuario\OneDrive\Desktop\Diabot-V2\finetuning_data.csv")
    output_csv = Path(r"c:\Users\Usuario\OneDrive\Desktop\Diabot-V2\finetuning_data_english.csv")
    output_instruction = Path(r"c:\Users\Usuario\OneDrive\Desktop\Diabot-V2\finetuning_data_instruction.jsonl")
    output_chat = Path(r"c:\Users\Usuario\OneDrive\Desktop\Diabot-V2\finetuning_data_chat.jsonl")
    
    # Create and run the translator
    translator = FinetuningDataTranslator(input_csv, output_csv, output_instruction, output_chat)
    
    # Force test mode for now
    print_warning("🧪 RUNNING IN TEST MODE (10 rows only)")
    translator.process(test_mode=False)