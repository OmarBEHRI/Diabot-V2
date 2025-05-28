import csv
import pandas as pd
import re
from pathlib import Path

def summarize_option_a(csv_file_path):
    """
    Create a new CSV file with the same structure as the original but with option A summarized.
    
    Args:
        csv_file_path (str): Path to the CSV file containing the QA dataset
    """
    try:
        # Read the CSV file
        df = pd.read_csv(csv_file_path)
        
        # Function to summarize text
        def summarize_text(text):
            # Remove any markdown formatting
            text = re.sub(r'\*\*|\*', '', text)
            
            # Split into sentences
            sentences = re.split(r'(?<=[.!?])\s+', text)
            
            # If there are more than 2 sentences, keep only the first 1-2 sentences
            if len(sentences) > 2:
                summary = ' '.join(sentences[:2])
            else:
                summary = text
                
            # Limit to 200 characters if longer, ending at a complete word
            if len(summary) > 200:
                summary = summary[:197] + '...'
                
            return summary
        
        # Create a new dataframe with summarized option A
        df_summarized = df.copy()
        df_summarized['A'] = df_summarized['A'].apply(summarize_text)
        
        # Generate output file path
        output_file = Path(csv_file_path).parent / 'Diabetes_QA_With_Summarized_A.csv'
        
        # Write to CSV
        df_summarized.to_csv(output_file, index=False)
        
        print(f"File with summarized option A successfully created and saved to: {output_file}")
        
    except Exception as e:
        print(f"Error processing the file: {e}")

if __name__ == "__main__":
    # Path to the CSV file
    csv_file = r"c:\Users\Usuario\OneDrive\Desktop\PFA\Diabot-V2\Benchmarking-QA-Datasets\Benchmarking-QA-Diabetes-With-Wrong-Answers.csv"
    
    # Summarize option A
    summarize_option_a(csv_file)