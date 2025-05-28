const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { callOpenRouter } = require('../backend/services/openrouter');
const { retrieveRelevantContext } = require('../backend/services/rag');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });

// Sample questions for benchmarking
const sampleQuestions = [
  {
    question: "What are the main symptoms of type 2 diabetes?",
    options: {
      A: "Increased thirst, frequent urination, fatigue, and blurred vision",
      B: "Fever, cough, and shortness of breath",
      C: "Joint pain, swelling, and stiffness",
      D: "Skin rash, itching, and hives"
    },
    answer: "A"
  },
  {
    question: "Which of the following is a risk factor for heart disease?",
    options: {
      A: "Regular exercise",
      B: "Low-sodium diet",
      C: "High blood pressure",
      D: "Adequate sleep"
    },
    answer: "C"
  },
  {
    question: "What is the recommended first-line treatment for mild hypertension?",
    options: {
      A: "Beta-blockers",
      B: "Lifestyle modifications",
      C: "ACE inhibitors",
      D: "Calcium channel blockers"
    },
    answer: "B"
  },
  {
    question: "Which of the following is a symptom of hypoglycemia?",
    options: {
      A: "Increased thirst",
      B: "Frequent urination",
      C: "Shakiness and sweating",
      D: "Slow healing wounds"
    },
    answer: "C"
  },
  {
    question: "What is the primary function of insulin in the body?",
    options: {
      A: "Break down fats",
      B: "Regulate blood sugar levels",
      C: "Filter waste from the blood",
      D: "Transport oxygen"
    },
    answer: "B"
  }
];

// Models to benchmark
const models = [
  {
    id: "mistralai/mistral-7b-instruct",
    name: "Mistral 7B Instruct"
  },
  {
    id: "anthropic/claude-instant-v1",
    name: "Claude Instant"
  },
  {
    id: "openai/gpt-3.5-turbo",
    name: "GPT-3.5 Turbo"
  }
];

// Function to format prompt for MCQ
function formatPrompt(question, options, context = "") {
  let prompt = "";
  
  if (context) {
    prompt += `You are a medical expert. Use the following context if helpful, then answer the multiple-choice question.
Respond with ONLY the letter of the correct option (e.g., A, B, C, D).

Context:
${context}

`;
  } else {
    prompt += `You are a medical expert. Please answer the following multiple-choice question.
Respond with ONLY the letter of the correct option (e.g., A, B, C, D).

`;
  }
  
  prompt += `Question: ${question}
Options:
`;
  
  for (const [letter, text] of Object.entries(options)) {
    prompt += `${letter}) ${text}
`;
  }
  
  prompt += `
Answer:`;
  
  return prompt;
}

// Function to parse model response
function parseResponse(response) {
  // Extract just the letter (A, B, C, D)
  const match = response.match(/^[A-D]/i);
  return match ? match[0].toUpperCase() : null;
}

// Main benchmarking function
async function runBenchmark() {
  console.log("Starting LLM benchmarking for medical questions...");
  console.log("==================================================");
  
  const results = [];
  
  for (const model of models) {
    console.log(`\nBenchmarking model: ${model.name} (${model.id})`);
    
    let correctNoRag = 0;
    let correctWithRag = 0;
    
    for (const [index, question] of sampleQuestions.entries()) {
      console.log(`\nQuestion ${index + 1}: ${question.question.substring(0, 50)}...`);
      
      // Scenario 1: No RAG
      try {
        console.log("  Testing without RAG...");
        const prompt = formatPrompt(question.question, question.options);
        const response = await callOpenRouter(model.id, [{ role: 'user', content: prompt }], 0.1, 50);
        const parsedAnswer = parseResponse(response);
        
        const isCorrect = parsedAnswer === question.answer;
        console.log(`  Response: ${response}`);
        console.log(`  Parsed answer: ${parsedAnswer}`);
        console.log(`  Correct: ${isCorrect ? "YES" : "NO"}`);
        
        if (isCorrect) correctNoRag++;
        
        // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  Error in No RAG scenario: ${error.message}`);
      }
      
      // Scenario 2: With RAG
      try {
        console.log("  Testing with RAG...");
        const context = await retrieveRelevantContext(question.question);
        const prompt = formatPrompt(question.question, question.options, context);
        const response = await callOpenRouter(model.id, [{ role: 'user', content: prompt }], 0.1, 50);
        const parsedAnswer = parseResponse(response);
        
        const isCorrect = parsedAnswer === question.answer;
        console.log(`  Response: ${response}`);
        console.log(`  Parsed answer: ${parsedAnswer}`);
        console.log(`  Correct: ${isCorrect ? "YES" : "NO"}`);
        
        if (isCorrect) correctWithRag++;
        
        // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  Error in RAG scenario: ${error.message}`);
      }
    }
    
    const accuracyNoRag = correctNoRag / sampleQuestions.length;
    const accuracyWithRag = correctWithRag / sampleQuestions.length;
    
    console.log(`\nResults for ${model.name}:`);
    console.log(`  Accuracy without RAG: ${(accuracyNoRag * 100).toFixed(1)}%`);
    console.log(`  Accuracy with RAG: ${(accuracyWithRag * 100).toFixed(1)}%`);
    console.log(`  Improvement with RAG: ${((accuracyWithRag - accuracyNoRag) * 100).toFixed(1)}%`);
    
    results.push({
      model_id: model.id,
      model_name: model.name,
      accuracy_no_rag: accuracyNoRag,
      accuracy_rag: accuracyWithRag,
      improvement: accuracyWithRag - accuracyNoRag
    });
  }
  
  // Save results to file
  const resultsPath = path.join(__dirname, '..', 'data', 'benchmark_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  
  console.log("\nBenchmark complete!");
  console.log(`Results saved to ${resultsPath}`);
  
  return results;
}

// Run the benchmark if this script is executed directly
if (require.main === module) {
  runBenchmark().catch(console.error);
}

module.exports = { runBenchmark };
