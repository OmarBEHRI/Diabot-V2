"use client"

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, MessageCircle, Shield, Database, BookOpen, Heart } from 'lucide-react';
import type React from 'react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center bg-gradient-to-br from-blue-600 to-cyan-700 text-white">
        <div className="max-w-5xl mx-auto flex md:flex-row flex-col items-center gap-8">
          <div className="md:w-1/3 flex justify-center">
            <img 
              src="/Diabot-Logo.png" 
              alt="Diabot Logo" 
              className="h-64 w-64 drop-shadow-lg" 
            />
          </div>
          <div className="md:w-2/3 flex flex-col md:items-start items-center">
            <h1 className="text-5xl font-extrabold mb-6 leading-tight tracking-tight text-center md:text-left">
              Your AI Medical Assistant for <span className="text-blue-200">Diabetes Management</span>
            </h1>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto md:mx-0 mb-10 leading-relaxed text-center md:text-left">
              Get accurate, personalized healthcare information powered by advanced AI technology
            </p>
            <div className="flex flex-wrap gap-6 justify-center md:justify-start">
              <Button
                className="bg-white text-blue-700 hover:bg-blue-50 px-8 py-6 text-lg font-medium rounded-full shadow-lg transition-all duration-300 flex items-center gap-2 hover:gap-3"
                onClick={() => {
                  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                  if (token) {
                    window.location.href = '/chat';
                  } else {
                    window.location.href = '/login';
                  }
                }}
              >
                Start Chatting <ArrowRight className="h-5 w-5" />
              </Button>
              <Link href="/login">
                <Button variant="outline" className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-700 px-8 py-6 text-lg font-medium rounded-full transition-all duration-300">
                  Login / Register
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">Experience the next generation of AI-powered healthcare assistance</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <FeatureCard 
              title="Advanced Medical AI"
              description="Chat with specialized AI models trained on verified medical knowledge and diabetes management protocols."
              icon={<MessageCircle className="h-8 w-8 text-blue-600" />}
            />
            <FeatureCard 
              title="RAG Technology"
              description="Get responses enhanced by Retrieval-Augmented Generation that combines AI with verified medical information sources."
              icon={<Database className="h-8 w-8 text-cyan-600" />}
            />
            <FeatureCard 
              title="Specialized Healthcare"
              description="Access information on general medicine, cardiology, pediatrics, and diabetes from a single intelligent interface."
              icon={<Heart className="h-8 w-8 text-blue-500" />}
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-12 items-center">
          <div className="md:w-1/2">
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-blue-500 to-cyan-600 aspect-square flex items-center justify-center">
              <img 
                src="/Diabot-Logo.png" 
                alt="Diabot Logo" 
                className="h-32 w-32 drop-shadow-lg" 
              />
            </div>
          </div>
          <div className="md:w-1/2">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">About Diabot</h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              Diabot is a sophisticated medical AI chat application designed to provide reliable healthcare information with a focus on diabetes management. 
              Our platform combines advanced large language models with a specialized medical knowledge base to deliver accurate and helpful responses.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Built with modern technology stack including Node.js/Express backend and Next.js frontend, Diabot offers a secure, responsive, and user-friendly experience.
              <span className="block mt-4 text-sm text-gray-500 italic">Note: While Diabot provides valuable information, it should not replace professional medical advice.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-700 pb-8 mb-8">
            <div className="mb-6 md:mb-0">
              <img 
                src="/Diabot-Logo.png" 
                alt="Diabot Logo" 
                className="h-10 w-10 mb-2 inline-block align-middle drop-shadow-md" 
              />
              <span className="text-2xl font-bold align-middle ml-2">Diabot</span>
              <p className="text-gray-400 mt-1">Your Medical AI Assistant</p>
            </div>
            <div className="flex gap-8">
              <Link href="/chat" className="text-gray-300 hover:text-white transition-colors">Chat</Link>
              <Link href="/login" className="text-gray-300 hover:text-white transition-colors">Login</Link>
              <Link href="#" className="text-gray-300 hover:text-white transition-colors">About</Link>
            </div>
          </div>
          <div className="text-center text-gray-500 text-sm">
            <p>© {new Date().getFullYear()} Diabot. All rights reserved.</p>
            <p className="mt-2">Developed with advanced AI technology for healthcare assistance.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 h-full flex flex-col">
      <div className="bg-blue-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed flex-grow">{description}</p>
    </div>
  );
}
