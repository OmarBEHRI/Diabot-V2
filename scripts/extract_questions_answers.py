import pandas as pd
from pathlib import Path

# Configuration
INPUT_CSV = Path(r"c:\Users\Usuario\OneDrive\Desktop\PFA\Diabot-V2\Benchmarking-QA-Datasets\Benchmarking-QA-Diabetes-With-Wrong-Answers.csv")
OUTPUT_CSV = Path(r"c:\Users\Usuario\OneDrive\Desktop\PFA\Diabot-V2\Benchmarking-QA-Datasets\Diabetes_QA_Questions_Answers.csv")

def extract_questions_answers():
    """
    Extract only the questions and correct answers (A) from the dataset.
    """
    try:
        # Read the CSV file
        df = pd.read_csv(INPUT_CSV)
        
        # Create a new dataframe with only id, Question, and A columns
        qa_df = df[['id', 'Question', 'A']]
        
        # Rename column A to Answer
        qa_df = qa_df.rename(columns={'A': 'Answer'})
        
        # Write to CSV
        qa_df.to_csv(OUTPUT_CSV, index=False)
        
        print(f"Questions and answers extracted and saved to: {OUTPUT_CSV}")
        
    except Exception as e:
        print(f"Error processing the file: {e}")

if __name__ == "__main__":
    extract_questions_answers()
