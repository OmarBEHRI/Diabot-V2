import json
import matplotlib.pyplot as plt
import numpy as np
import os

# Paths to the summary JSON files
first_method_path = os.path.join('First-Method-Results', 'first-method-model-results-summary.json')
second_method_no_rag_path = os.path.join('Second-Method-Results', 'second-method-model-no-rag-results.json')
second_method_with_rag_path = os.path.join('Second-Method-Results', 'second-method-model-with-rag-results.json')

# Helper to load model/accuracy from a summary file
def load_model_accuracies(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Normalize model names for display, fix possible floats as accuracy
    out = []
    for entry in data:
        model = entry['model']
        acc = entry['accuracy']
        # Some files have accuracy as float in [0,1], some as percent
        if acc is not None and acc <= 1.0:
            acc = acc * 100
        out.append((model, acc))
    return out

# Load all results
first_method = load_model_accuracies(first_method_path)
second_method_no_rag = load_model_accuracies(second_method_no_rag_path)
second_method_with_rag = load_model_accuracies(second_method_with_rag_path)

# Helper for nice plot labels
METHOD_LABELS = {
    'first': 'First Method',
    'second_no_rag': 'Second Method (No RAG)',
    'second_with_rag': 'Second Method (With RAG)'
}

# --- Plotting function ---
def plot_histogram(models, accuracies, title, color, save_path):
    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.barh(models, accuracies, color=color, edgecolor='black', alpha=0.85)
    ax.set_xlabel('Accuracy (%)', fontsize=13)
    ax.set_title(title, fontsize=16, weight='bold')
    ax.set_xlim([0, 105])
    ax.invert_yaxis()  # Best model at the top
    # Annotate bars
    for bar, acc in zip(bars, accuracies):
        ax.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2, f'{acc:.2f}%',
                va='center', ha='left', fontsize=11, color='#222')
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    plt.show()

# --- Prepare and plot ---
def plot_all():
    # First Method
    sorted1 = sorted(first_method, key=lambda x: x[1], reverse=True)
    models1, accs1 = zip(*sorted1)
    plot_histogram(models1, accs1, f'Model Performance: {METHOD_LABELS["first"]}', '#4F8EF7', 'first-method-histogram.png')
    # Second Method (No RAG)
    sorted2 = sorted(second_method_no_rag, key=lambda x: x[1], reverse=True)
    models2, accs2 = zip(*sorted2)
    plot_histogram(models2, accs2, f'Model Performance: {METHOD_LABELS["second_no_rag"]}', '#2ECC40', 'second-method-no-rag-histogram.png')
    # Second Method (With RAG)
    sorted3 = sorted(second_method_with_rag, key=lambda x: x[1], reverse=True)
    models3, accs3 = zip(*sorted3)
    plot_histogram(models3, accs3, f'Model Performance: {METHOD_LABELS["second_with_rag"]}', '#FF851B', 'second-method-with-rag-histogram.png')

if __name__ == '__main__':
    plot_all()
