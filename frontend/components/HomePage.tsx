import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-green-50">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-blue-800 mb-4">Welcome to Diabot</h1>
        <p className="text-xl text-gray-700 max-w-3xl mb-8">
          Your AI-powered medical assistant for diabetes management and healthcare information
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link href="/chat">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg">
              Start Chatting
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-6 text-lg">
              Login / Register
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-blue-800 mb-12">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              title="Medical AI Chat"
              description="Chat with multiple AI models specialized in medical knowledge and diabetes management."
              icon="💬"
            />
            <FeatureCard 
              title="RAG Technology"
              description="Enhanced responses using Retrieval-Augmented Generation with verified medical information."
              icon="🔍"
            />
            <FeatureCard 
              title="Multiple Topics"
              description="Specialized conversations on general medicine, cardiology, pediatrics, and diabetes."
              icon="📚"
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-4 bg-blue-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-blue-800 mb-8">About Diabot</h2>
          <p className="text-lg text-gray-700 mb-6">
            Diabot is a full-stack medical AI chat application designed to provide reliable healthcare information with a focus on diabetes management. 
            Our application combines the power of large language models with a specialized medical knowledge base to deliver accurate and helpful responses.
          </p>
          <p className="text-lg text-gray-700">
            Built with Node.js/Express backend and Next.js frontend, Diabot offers a secure, responsive, and user-friendly experience for accessing medical information.
            Please note that while Diabot provides valuable information, it should not replace professional medical advice.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-blue-800 text-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <h3 className="text-xl font-bold">Diabot</h3>
            <p className="text-blue-200">Your Medical AI Assistant</p>
          </div>
          <div className="flex gap-8">
            <Link href="/chat" className="text-blue-200 hover:text-white">Chat</Link>
            <Link href="/login" className="text-blue-200 hover:text-white">Login</Link>
            <Link href="#" className="text-blue-200 hover:text-white">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="bg-blue-50 p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-blue-800 mb-2">{title}</h3>
      <p className="text-gray-700">{description}</p>
    </div>
  );
}
