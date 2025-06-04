import pandas as pd
import requests
import time
import os
import json
from tqdm import tqdm
from pathlib import Path

def translate_with_openrouter(text, api_key, source_lang="fr", target_lang="en"):
    """Translate text using OpenRouter API with Gemini 2.5 Flash."""
    url = "https://openrouter.ai/api/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Create a system prompt for translation
    system_prompt = f"You are a professional translator. Translate the following text from {source_lang} to {target_lang}. Maintain the original meaning, tone, and formatting. Do not add or remove information. Return only the translated text without any additional comments or explanations."
    
    data = {
        "model": "google/gemini-2.5-flash-preview",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ],
        "temperature": 0.1  # Low temperature for more consistent translations
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()  # Raise exception for HTTP errors
        result = response.json()
        translated_text = result["choices"][0]["message"]["content"]
        return translated_text
    except Exception as e:
        print(f"Translation error: {e}")
        # Return original text if translation fails
        return text

def clean_answer(answer):
    """Remove 'Answer:' prefix if it exists."""
    if isinstance(answer, str):
        if answer.startswith("Answer:"):
            return answer[len("Answer:"):].strip()
        if answer.startswith("Réponse:"):
            return answer[len("Réponse:"):].strip()
    return answer

def process_finetuning_data(input_file, output_file, api_key=None, batch_size=10, translate=True):
    """Process the finetuning data: translate to English and clean answers."""
    print(f"Loading data from {input_file}...")
    df = pd.read_csv(input_file)
    
    total_rows = len(df)
    print(f"Found {total_rows} rows to process")
    
    if api_key and translate:
        print("Starting translation process...")
        
        # Process in batches to avoid API rate limits
        translated_questions = []
        translated_answers = []
        
        for i in tqdm(range(0, total_rows, batch_size)):
            batch_end = min(i + batch_size, total_rows)
            batch_df = df.iloc[i:batch_end]
            
            # Translate questions
            for question in batch_df['question']:
                translated = translate_with_openrouter(question, api_key)
                translated_questions.append(translated)
                time.sleep(1)  # Add delay to avoid rate limits
            
            # Translate answers
            for answer in batch_df['model_answer']:
                translated = translate_with_openrouter(answer, api_key)
                # Clean the answer by removing "Answer:" prefix
                cleaned = clean_answer(translated)
                translated_answers.append(cleaned)
                time.sleep(1)  # Add delay to avoid rate limits
        
        # Update DataFrame with translated content
        df['question'] = translated_questions
        df['model_answer'] = translated_answers
    else:
        # If no API key or translation not requested, just clean the answers
        print("Skipping translation and only cleaning answers...")
        df['model_answer'] = df['model_answer'].apply(clean_answer)
    
    # Save processed data
    print(f"Writing processed data to {output_file}...")
    df.to_csv(output_file, index=False)
    print(f"Processing complete! {total_rows} rows processed and saved to {output_file}")
    
    return df

def convert_to_instruction_format(df, output_file):
    """Convert the dataset to instruction format with prompt and completion fields."""
    print("Converting to instruction format...")
    
    # Create instruction format data
    instruction_data = []
    for _, row in df.iterrows():
        instruction_data.append({
            "prompt": row['question'],
            "completion": row['model_answer']
        })
    
    # Save to JSONL file
    print(f"Writing instruction format data to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in instruction_data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    print(f"Conversion complete! {len(instruction_data)} rows converted to instruction format.")

def convert_to_chat_format(df, output_file):
    """Convert the dataset to chat format with messages field."""
    print("Converting to chat format...")
    
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
    print(f"Writing chat format data to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in chat_data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    print(f"Conversion complete! {len(chat_data)} rows converted to chat format.")

if __name__ == "__main__":
    # Get project paths
    project_root = Path("c:/Users/Usuario/OneDrive/Desktop/PFA")
    input_file = project_root / "Diabot-V2" / "finetuning_data.csv"
    processed_csv = project_root / "Diabot-V2" / "finetuning_data_english.csv"
    instruction_format = project_root / "Diabot-V2" / "finetuning_data_instruction.jsonl"
    chat_format = project_root / "Diabot-V2" / "finetuning_data_chat.jsonl"
    
    # Get API key from environment
    api_key = os.environ.get("OPENROUTER_API_KEY")
    
    # Determine if we should translate
    translate = False  # Default to False if no API key
    if api_key:
        translate = True
        print("OpenRouter API key found. Will translate data from French to English.")
    else:
        print("No OpenRouter API key found. Will only clean answers without translation.")
    
    # Process the data
    df = process_finetuning_data(input_file, processed_csv, api_key, translate=translate)
    
    # Convert to instruction format (prompt/completion)
    convert_to_instruction_format(df, instruction_format)
    
    # Convert to chat format (messages with roles)
    convert_to_chat_format(df, chat_format)
    
    print("\nAll processing complete!")
    print(f"1. Processed CSV: {processed_csv}")
    print(f"2. Instruction Format: {instruction_format}")
    print(f"3. Chat Format: {chat_format}")
    print("\nYou can now use these files for finetuning your model.")
