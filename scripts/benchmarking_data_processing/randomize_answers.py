import pandas as pd
import numpy as np
import json
import random
from pathlib import Path

def randomize_answers(input_csv_path):
    """
    Randomize the position of correct answers in the CSV file and store the correct answer positions in a JSON file.
    
    Args:
        input_csv_path (str): Path to the input CSV file with correct answers in column A
    
    Returns:
        None: Creates two files - a CSV with randomized answers and a JSON with correct answer positions
    """
    try:
        # Read the CSV file
        df = pd.read_csv(input_csv_path)
        
        # Create a dictionary to store the correct answers
        correct_answers = {}
        
        # Create a new dataframe for the randomized answers
        randomized_df = df.copy()
        
        # Options for randomization
        options = ['A', 'B', 'C', 'D']
        
        # Iterate through each row
        for index, row in df.iterrows():
            question_id = row['id']
            
            # Get the correct answer from column A
            correct_answer = row['A']
            
            # Randomly choose a position for the correct answer
            correct_position = random.choice(options)
            
            # Store the correct position in the dictionary
            correct_answers[question_id] = correct_position
            
            # Shuffle the answers (except the correct one)
            wrong_answers = [row['B'], row['C'], row['D']]
            random.shuffle(wrong_answers)
            
            # Place the answers in the new dataframe based on the random position
            if correct_position == 'A':
                randomized_df.at[index, 'A'] = correct_answer
                randomized_df.at[index, 'B'] = wrong_answers[0]
                randomized_df.at[index, 'C'] = wrong_answers[1]
                randomized_df.at[index, 'D'] = wrong_answers[2]
            elif correct_position == 'B':
                randomized_df.at[index, 'A'] = wrong_answers[0]
                randomized_df.at[index, 'B'] = correct_answer
                randomized_df.at[index, 'C'] = wrong_answers[1]
                randomized_df.at[index, 'D'] = wrong_answers[2]
            elif correct_position == 'C':
                randomized_df.at[index, 'A'] = wrong_answers[0]
                randomized_df.at[index, 'B'] = wrong_answers[1]
                randomized_df.at[index, 'C'] = correct_answer
                randomized_df.at[index, 'D'] = wrong_answers[2]
            else:  # D
                randomized_df.at[index, 'A'] = wrong_answers[0]
                randomized_df.at[index, 'B'] = wrong_answers[1]
                randomized_df.at[index, 'C'] = wrong_answers[2]
                randomized_df.at[index, 'D'] = correct_answer
        
        # Generate output file paths
        output_dir = Path(input_csv_path).parent
        output_csv = output_dir / 'Diabetes_QA_Randomized_Answers.csv'
        output_json = output_dir / 'Diabetes_QA_Correct_Answers.json'
        
        # Write the randomized dataframe to CSV
        randomized_df.to_csv(output_csv, index=False)
        
        # Write the correct answers to JSON
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(correct_answers, f, indent=4, ensure_ascii=False)
        
        print(f"Randomized CSV file created at: {output_csv}")
        return output_csv, output_json
        
    except Exception as e:
        print(f"Error processing the file: {e}")
        return None, None

if __name__ == "__main__":
    import os
    from pathlib import Path
    
    # Get the project root directory (two levels up from this script)
    project_root = Path(__file__).parent.parent.parent
    
    # Path to the input CSV file
    input_csv = project_root / "Benchmarking" / "Datasets" / "processed" / "Diabetes_QA_With_Summarized_A.csv"
    
    # Create output directory if it doesn't exist
    output_dir = project_root / "Benchmarking" / "Datasets" / "processed"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Call the function to randomize answers
    output_csv, output_json = randomize_answers(input_csv)
    
    print(f"Randomized answers saved to: {output_csv}")
    print(f"Correct answers mapping saved to: {output_json}")
