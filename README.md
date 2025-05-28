# Diabot - Medical LLM Chat Application

A full-stack medical AI chat application with RAG (Retrieval-Augmented Generation) capabilities, built with Node.js/Express backend and Next.js frontend.

## Features

- **User Authentication**: Secure login and registration system
- **Multiple AI Models**: Support for various LLM models via OpenRouter
- **Medical Topics**: Specialized medical conversation topics
- **RAG System**: Enhanced responses using medical document retrieval
- **Chat History**: Persistent conversation storage
- **Real-time Chat**: Interactive chat interface with typing indicators

## Tech Stack

### Backend
- Node.js with Express.js
- SQLite database with better-sqlite3
- JWT authentication
- OpenRouter API integration
- RAG system with ChromaDB (planned)

### Frontend
- Next.js 15 with React 19
- TypeScript
- Tailwind CSS
- Radix UI components
- Axios for API calls

## Project Structure

```
Diabot-PFA-Project/
├── backend/
│   ├── data/                 # Database and RAG sources
│   ├── middleware/           # Authentication middleware
│   ├── routes/              # API routes
│   ├── services/            # Business logic
│   ├── db.js               # Database setup
│   └── server.js           # Express server
├── frontend/
│   ├── app/                # Next.js app directory
│   ├── components/         # React components
│   ├── context/           # React context providers
│   ├── lib/               # Utilities and API client
│   └── styles/            # CSS styles
├── data/
│   └── rag_sources/       # Medical documents for RAG
└── scripts/               # Utility scripts
```

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- OpenRouter API key

### 1. Clone and Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Configuration

#### Backend (.env in backend folder):
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
JWT_SECRET=your_jwt_secret_here
PORT=3000
```

#### Frontend (.env.local in frontend folder):
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Database Setup

The database will be automatically created and populated with default models and topics when you first run the backend.

### 4. Running the Application

#### Option 1: Manual Start
```bash
# Terminal 1 - Start Backend
cd backend
npm start

# Terminal 2 - Start Frontend
cd frontend
npm run dev
```

#### Option 2: Using the Batch Script (Windows)
```bash
# Run the provided batch script
start-dev.bat
```

### 5. Access the Application

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Models & Topics
- `GET /api/models` - Get available AI models
- `GET /api/topics` - Get medical topics

### Chat
- `POST /api/chat/new_session` - Create new chat session
- `POST /api/chat/:sessionId/message` - Send message
- `GET /api/chat/sessions` - Get user's chat sessions
- `GET /api/chat/:sessionId/messages` - Get session messages

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Select Model & Topic**: Choose an AI model and medical topic
3. **Start Chat**: Click "Start Chat" and enter your medical question
4. **Continue Conversation**: Send additional messages in the chat
5. **View History**: Access previous conversations from the sidebar

## Default Models

The application comes with these pre-configured models:
- Mistral 7B Instruct (balanced performance)
- Claude Instant (fast and accurate)
- GPT-3.5 Turbo (good general knowledge)

## Default Topics

Available medical topics:
- General Medicine
- Cardiology
- Pediatrics
- Diabetes

## Development Notes

### Frontend Integration
- Uses React Context for state management
- Axios interceptors handle authentication
- Real-time UI updates for chat messages
- Responsive design with Tailwind CSS

### Backend Integration
- JWT-based authentication
- SQLite for data persistence
- OpenRouter API for LLM access
- Prepared for RAG system integration

### Security Features
- Password hashing with bcrypt
- JWT token validation
- CORS configuration
- Input validation and sanitization

## Troubleshooting

### Common Issues

1. **Backend won't start**: Check if port 3000 is available
2. **Frontend can't connect**: Verify NEXT_PUBLIC_API_URL in .env.local
3. **Authentication errors**: Ensure JWT_SECRET is set in backend .env
4. **Database errors**: Check write permissions in backend/data folder

### Logs
- Backend logs appear in the terminal running the server
- Frontend logs appear in browser console and terminal

## Future Enhancements

- [ ] RAG system implementation with ChromaDB
- [ ] Real-time streaming responses
- [ ] File upload for medical documents
- [ ] Advanced model benchmarking
- [ ] User preferences and settings
- [ ] Export chat conversations
- [ ] Mobile app development

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational purposes as part of a PFA (Projet de Fin d'Année) project.
