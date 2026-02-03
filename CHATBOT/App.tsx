import React from 'react';
import ChatbotPopup from './components/ChatbotPopup';

const App: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Main content of your application would go here */}
      <header className="bg-blue-800 text-white p-4 shadow-md">
        <h1 className="text-3xl font-bold text-center">Business Insight Hub</h1>
      </header>
      <main className="p-4 text-center">
        <p className="text-gray-700">
          Click the chat icon to get expert advice on business management.
        </p>
      </main>
      
      {/* The Chatbot Popup component */}
      <ChatbotPopup />
    </div>
  );
};

export default App;