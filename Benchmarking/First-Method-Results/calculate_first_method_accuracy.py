import os
import json
import csv
import pandas as pd

# Paths
results_dir = r"c:\Users\Asus\Desktop\Diabot-PFA-Project\Benchmarking\First-Method-Results"
reference_csv = r"c:\Users\Asus\Desktop\Diabot-PFA-Project\Benchmarking\Datasets\refference-answers\Diabetes_QA_Questions_Answers.csv"
output_csv = os.path.join(results_dir, "benchmark_accuracy_summary.csv")

# Load reference answers
ref_answers = {}
df = pd.read_csv(reference_csv)
for idx, row in df.iterrows():
    ref_answers[str(row['id'])] = row['Answer'].strip()

# Find all benchmark result files
benchmarks = [f for f in os.listdir(results_dir) if f.endswith('.json') and f.startswith('benchmark_')]

results = []
for filename in benchmarks:
    path = os.path.join(results_dir, filename)
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Model name
    model = data.get('model') or filename.replace('benchmark_', '').rsplit('_', 1)[0]
    # Answers
    answers = data.get('answers', data)
    # If answers is not a dict, skip
    if not isinstance(answers, dict):
        continue
    # Read accuracy from 'evaluation' field if present
    accuracy = None
    if 'evaluation' in data and isinstance(data['evaluation'], dict):
        accuracy = data['evaluation'].get('accuracy')
    if accuracy is None:
        # fallback: try to read from top-level 'accuracy' or 'metrics' field
        accuracy = data.get('accuracy')
    if accuracy is None:
        accuracy = data.get('metrics', {}).get('accuracy')
    if accuracy is not None:
        try:
            accuracy = float(accuracy)
        except Exception:
            accuracy = 0.0
    else:
        accuracy = 0.0
    results.append((model, round(accuracy, 2)))

# Write to JSON
output_json = os.path.join(results_dir, "benchmark_accuracy_summary.json")
with open(output_json, 'w', encoding='utf-8') as f:
    json.dump([
        {"model": model, "accuracy": acc} for model, acc in results
    ], f, indent=2, ensure_ascii=False)

print(f"Wrote accuracy results for {len(results)} models to {output_json}")
