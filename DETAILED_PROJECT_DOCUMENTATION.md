# Diabot-V2: Comprehensive Medical AI Assistant Project Documentation

## Project Overview

Diabot-V2 is an advanced medical AI assistant specialized in diabetes care and management. The project combines a full-stack web application with sophisticated natural language processing capabilities to provide accurate, contextually relevant medical information to users. The system leverages retrieval-augmented generation (RAG), fine-tuned language models, and comprehensive benchmarking to ensure high-quality responses.

## Core Components

### 1. Web Application Architecture

#### Backend (Node.js/Express)
- **Server**: Express.js application handling API requests, authentication, and database operations
- **Database**: SQLite with better-sqlite3 for data persistence
- **Authentication**: JWT-based user authentication system
- **API Integration**: OpenRouter API client for accessing various LLM models
- **RAG System**: ChromaDB integration for vector storage and retrieval

#### Frontend (Next.js)
- **Framework**: Next.js 15 with React 19
- **UI**: Tailwind CSS with Radix UI components
- **State Management**: React Context API for global state
- **API Client**: Axios for backend communication
- **TypeScript**: Type-safe code throughout the application

### 2. AI and NLP Components

#### Language Model Integration
- **Primary Model**: Google Gemini 2.5 Flash via OpenRouter API
- **Alternative Models**: Support for various models through OpenRouter
- **Prompt Engineering**: Specialized medical prompts optimized for diabetes information

#### RAG (Retrieval-Augmented Generation) System
- **Vector Database**: ChromaDB for storing document embeddings
- **Embedding Model**: SentenceTransformer for text vectorization
- **Document Processing**: Chunking and embedding pipeline for medical documents
- **Retrieval Strategy**: Semantic search with relevance scoring

#### Dataset Translation and Processing
- **Source Data**: French diabetes Q&A dataset (`finetuning_data.csv`)
- **Translation Pipeline**: Custom Python script using OpenRouter API with Gemini 2.5 Flash
- **Data Cleaning**: Removal of prefixes, formatting standardization
- **Output Formats**: CSV, instruction format JSONL, and chat format JSONL

### 3. Benchmarking and Evaluation

#### Benchmarking Methodologies
- **First Method**: Comparative evaluation against reference answers
- **Second Method**: Free-form answer quality assessment
- **Metrics**: Accuracy, relevance, completeness, and medical correctness

#### Evaluation Tools
- **Automated Scripts**: Python-based evaluation pipelines
- **Data Processing**: Tools for randomizing answers, generating incorrect responses
- **Results Analysis**: Statistical analysis of model performance

## Technical Details

### Dataset Translation Process

The translation component (`translate_finetuning_data.py`) is a critical part of the project that:

1. **Loads French Dataset**: Processes the original French diabetes Q&A dataset
2. **Translates Content**: Uses OpenRouter API with Google Gemini 2.5 Flash to translate questions and answers to English
3. **Cleans Responses**: Removes prefixes like "Answer:" or "Réponse:" and standardizes formatting
4. **Batch Processing**: Implements rate-limited batch processing with progress tracking
5. **Multiple Output Formats**:
   - CSV with translated content
   - Instruction format JSONL (prompt/completion pairs)
   - Chat format JSONL (conversation messages with roles)

The translation process includes:
- Error handling with retries
- Progress saving after each translation
- Detailed logging of API interactions
- Test mode for processing limited datasets

### RAG Implementation

The RAG system enhances response quality by:

1. **Document Processing**: Medical textbooks and documents are processed into chunks
2. **Embedding Generation**: Text chunks are converted to vector embeddings
3. **Semantic Search**: User queries are matched against the document database
4. **Context Augmentation**: Relevant document chunks are included in the prompt
5. **Response Generation**: The LLM generates responses using both the query and retrieved context

### Finetuning Pipeline

The model finetuning process involves:

1. **Data Preparation**: Translated and cleaned dataset in appropriate format
2. **Training Configuration**: Hyperparameter settings for optimal learning
3. **Model Selection**: Base model choice for finetuning
4. **Training Execution**: Finetuning process on prepared dataset
5. **Evaluation**: Benchmarking of finetuned model against baseline

## Deployment Architecture

### Local Development
- **Backend**: Node.js server on port 3000
- **Frontend**: Next.js development server on port 3001
- **Database**: Local SQLite database file
- **Vector Store**: Local ChromaDB instance

### Production Deployment (Planned)
- **Containerization**: Docker with docker-compose for service orchestration
- **Hosting Options**: Cloud deployment on AWS, Azure, or similar platforms
- **CI/CD**: Automated testing and deployment pipeline
- **Scaling**: Horizontal scaling for handling increased user load

## Data Flow

1. **User Interaction**: User submits a query through the frontend interface
2. **Authentication**: Backend validates user session
3. **Query Processing**: Backend processes the query and determines context
4. **RAG Retrieval**: Relevant documents are retrieved from ChromaDB
5. **LLM Generation**: Query and context are sent to the LLM via OpenRouter
6. **Response Delivery**: Generated response is returned to the frontend
7. **History Storage**: Conversation is saved to the database

## Security Considerations

- **API Key Management**: Environment variables for secure key storage
- **Authentication**: JWT tokens with appropriate expiration
- **Data Protection**: Minimal personal data collection and storage
- **Input Validation**: Sanitization of user inputs to prevent injection attacks
- **Rate Limiting**: Protection against excessive API usage

## Performance Optimization

- **Caching**: Response caching for common queries
- **Batch Processing**: Efficient handling of multiple operations
- **Lazy Loading**: Frontend components load as needed
- **Database Indexing**: Optimized queries for faster retrieval
- **Embedding Compression**: Reduced vector dimensionality for storage efficiency

## Development Workflow

1. **Local Setup**: Installation of dependencies and environment configuration
2. **Data Preparation**: Processing and translation of datasets
3. **Model Selection**: Choosing appropriate models for different tasks
4. **Implementation**: Development of features according to specifications
5. **Testing**: Validation of functionality and performance
6. **Benchmarking**: Comparative evaluation against baseline
7. **Deployment**: Release to production environment

## Future Enhancements

- **Multilingual Support**: Expansion to additional languages beyond English and French
- **Mobile Application**: Native mobile apps for iOS and Android
- **Voice Interface**: Speech recognition and synthesis for voice interactions
- **Personalization**: User-specific response tailoring based on medical history
- **Expanded Knowledge Base**: Additional medical domains beyond diabetes

## Technical Requirements

- **Node.js**: v18 or higher
- **Python**: 3.9 or higher
- **OpenRouter API Key**: For model access
- **Storage**: Minimum 2GB for database and vector store
- **Memory**: 4GB RAM minimum, 8GB recommended

## Installation and Setup

Detailed steps for setting up the development environment:

1. **Clone Repository**: `git clone [repository-url]`
2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Then edit with your API keys
   npm start
   ```
3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local  # Then edit with your configuration
   npm run dev
   ```
4. **Database Initialization**: Automatically handled on first backend start
5. **RAG Setup**:
   ```bash
   cd scripts/rag_data_extraction
   python process_textbook.py
   ```
6. **Translation Pipeline**:
   ```bash
   # Set OPENROUTER_API_KEY in your environment
   python translate_finetuning_data.py
   ```

## Project Structure

```
Diabot-V2/
├── backend/                     # Node.js Express server
│   ├── data/                    # Database files
│   ├── middleware/              # Express middleware
│   ├── routes/                  # API endpoints
│   ├── services/                # Business logic
│   ├── db.js                    # Database setup
│   └── server.js                # Main server file
├── frontend/                    # Next.js application
│   ├── app/                     # Next.js app directory
│   ├── components/              # React components
│   ├── context/                 # React context providers
│   ├── lib/                     # Utility functions
│   └── styles/                  # CSS styles
├── data/                        # Data storage
│   └── rag_sources/             # Medical documents for RAG
├── scripts/                     # Utility scripts
│   ├── benchmarking_data_processing/    # Benchmark data preparation
│   ├── benchmarking_first_method_scripts/  # First benchmarking method
│   ├── benchmarking_second_method_scripts/ # Second benchmarking method
│   ├── finetuning_data_preparation/     # Finetuning data scripts
│   └── rag_data_extraction/             # RAG processing scripts
├── chroma_db/                   # Vector database storage
├── Benchmarking/                # Benchmarking results and datasets
│   ├── Datasets/                # Test datasets
│   ├── First-Method-Results/    # Results from first method
│   └── Second-Method-Results/   # Results from second method
├── translate_finetuning_data.py # Dataset translation script
├── finetuning_data.csv          # Original French dataset
├── finetuning_data_english.csv  # Translated English dataset
├── finetuning_data_instruction.jsonl  # Instruction format dataset
├── finetuning_data_chat.jsonl   # Chat format dataset
└── docker-compose.yml           # Docker configuration
```

## Conclusion

Diabot-V2 represents a comprehensive approach to medical AI assistance, combining modern web technologies with advanced NLP techniques. The project's focus on diabetes management provides specialized knowledge while maintaining the flexibility to expand to other medical domains. Through careful dataset preparation, model selection, and evaluation, the system aims to deliver accurate, helpful information to users seeking diabetes-related guidance.

The modular architecture allows for continuous improvement and adaptation as new models and techniques become available. The combination of retrieval-augmented generation with fine-tuned models creates a robust system capable of handling a wide range of medical queries with appropriate context and accuracy.
