import benchmarkResults from '@/benchmarking/second-method-model-results-summary.json';

// Map model names from benchmark results to OpenRouter IDs
const modelNameToOpenRouterId: Record<string, string> = {
  'Llama-3.1-8b-instruct-fine-tuned': 'meta-llama/llama-3.1-8b-instruct',
  'qwen/qwen-2.5-7b-instruct': 'qwen/qwen-2.5-7b-instruct',
  'openai/gpt-4.1-mini': 'openai/gpt-4.1-mini',
  'mistralai/mistral-nemo': 'mistralai/mistral-nemo',
  'meta-llama/llama-4-scout': 'meta-llama/llama-4-scout',
  'meta-llama/llama-3.1-8b-instruct': 'meta-llama/llama-3.1-8b-instruct',
  'google/gemma-3-4b-it': 'google/gemma-3-4b-it',
  'google/gemini-2.5-flash-preview-05-20': 'google/gemini-2.5-flash-preview',
  'google/gemini-2.0-flash-001': 'google/gemini-2.0-flash'
};

// Models to exclude from the selector
const excludedModels = [
  'anthropic/claude-instant', // Exclude all versions of Claude Instant
  'claude-instant',
  'mistralai/mistral-7b-instruct',
  'mistral-7b-instruct'
];

// Model IDs to exclude from the selector (database IDs)
const excludedModelIds = [1, 2]; // 1: Mistral 7B Instruct, 2: Claude Instant

export interface ModelAccuracy {
  model: string;
  accuracy: number;
}

export function getModelAccuracy(openRouterId: string): number {
  // Find matching benchmark result
  for (const [benchmarkName, routerId] of Object.entries(modelNameToOpenRouterId)) {
    if (openRouterId.includes(routerId)) {
      const benchmarkResult = benchmarkResults.find(result => result.model === benchmarkName);
      if (benchmarkResult) {
        return benchmarkResult.accuracy / 100; // Convert percentage to decimal
      }
    }
  }
  
  // Default fallback accuracy if no match found
  return 0.75;
}

export function shouldExcludeModel(openRouterId: string, modelId?: number): boolean {
  // Check by model ID if provided (more reliable)
  if (modelId !== undefined) {
    return excludedModelIds.includes(modelId);
  }
  
  // Fallback to checking by OpenRouter ID
  return excludedModels.some(excludedModel => openRouterId.includes(excludedModel));
}
