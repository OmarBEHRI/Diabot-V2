import pandas as pd
from pathlib import Path

# Get the project root directory (two levels up from this script)
PROJECT_ROOT = Path(__file__).parent.parent.parent

# Configuration
INPUT_CSV = PROJECT_ROOT / "Benchmarking" / "Datasets" / "processed" / "Benchmarking-QA-Diabetes-With-Wrong-Answers.csv"
OUTPUT_CSV = PROJECT_ROOT / "Benchmarking" / "Datasets" / "refference-answers" / "Diabetes_QA_Questions_Answers.csv"

# Ensure output directory exists
OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)

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
