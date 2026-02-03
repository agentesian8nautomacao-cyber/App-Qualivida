import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sendMessageToGemini, initializeChat, resetChatSession } from '../services/geminiService';
import { ChatMessage } from '../types';

const ChatbotPopup: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Initial system message
    setMessages([{ role: 'system', content: "Hello! I'm your business management expert. Ask me anything about business strategy, operations, finance, or marketing." }]);
    // Initialize the chat session when the component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Set a max height to prevent the textarea from growing too large
      const maxHeight = Math.min(textarea.scrollHeight, 120); // Max 120px height
      textarea.style.height = `${maxHeight}px`;
    }
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [input, autoResizeTextarea]);

  const handleSendMessage = useCallback(async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let geminiResponseIndex = messages.length + 1; // Index for the new Gemini message
      setMessages((prev) => [
        ...prev,
        { role: 'gemini', content: '', isStreaming: true },
      ]);

      await sendMessageToGemini(
        userMessage.content,
        (chunk) => {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.role === 'gemini' && lastMessage.isStreaming) {
              return prev.map((msg, index) =>
                index === prev.length - 1
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              );
            } else {
              // This case should ideally not happen if `isStreaming` is managed correctly
              // but as a fallback, add a new message.
              return [...prev, { role: 'gemini', content: chunk, isStreaming: true }];
            }
          });
        },
        (error: string) => {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.role === 'gemini' && lastMessage.isStreaming) {
              return prev.map((msg, index) =>
                index === prev.length - 1
                  ? { ...msg, content: `Error: ${error}`, isError: true, isStreaming: false }
                  : msg
              );
            } else {
              return [...prev, { role: 'gemini', content: `Error: ${error}`, isError: true, isStreaming: false }];
            }
          });
          console.error("Chatbot error:", error);
        }
      );
      // After streaming is complete, remove isStreaming flag
      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === 'gemini' && msg.isStreaming
            ? { ...msg, isStreaming: false }
            : msg
        )
      );
    } catch (error: any) {
      console.error("Failed to send message:", error);
      setMessages((prev) => [
        ...prev,
        { role: 'gemini', content: `Sorry, something went wrong. Please try again. (${error.message || 'Unknown error'})`, isError: true },
      ]);
    } finally {
      setIsLoading(false);
      autoResizeTextarea();
    }
  }, [input, isLoading, messages.length, autoResizeTextarea]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const togglePopup = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        // Only initialize chat if opening and not already open
        initializeChat();
      }
      return !prev;
    });
  }, []);

  const handleResetChat = useCallback(() => {
    resetChatSession();
    setMessages([{ role: 'system', content: "Hello! I'm your business management expert. Ask me anything about business strategy, operations, finance, or marketing." }]);
  }, []);

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={togglePopup}
          className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 z-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
          aria-label="Open Chatbot"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </button>
      )}

      {/* Chat Popup Window */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-8 sm:right-8 w-full h-full sm:w-11/12 sm:max-w-md md:w-[400px] sm:h-3/4 sm:max-h-[600px] bg-white rounded-t-lg sm:rounded-lg shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-out">
          {/* Header */}
          <div className="flex justify-between items-center p-4 bg-blue-700 text-white rounded-t-lg shadow-md">
            <h2 className="text-xl font-semibold">Business Management Chat</h2>
            <div className="flex space-x-2">
              <button
                onClick={handleResetChat}
                className="p-1 rounded-full hover:bg-blue-600 transition-colors duration-200"
                aria-label="Start New Chat"
                title="Start New Chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.188l.056.03a1 1 0 00.902-.153l2.872-2.154a1 1 0 011.25-.015l2.872 2.154a1 1 0 00.902.153L15 5.188V3a1 1 0 112 0v5.5H3V3a1 1 0 011-1zM3 9.5h14V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5zM7 12a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={togglePopup}
                className="p-1 rounded-full hover:bg-blue-600 transition-colors duration-200"
                aria-label="Close Chatbot"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-lg shadow-sm text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : msg.role === 'gemini'
                      ? msg.isError
                          ? 'bg-red-200 text-red-800'
                          : 'bg-gray-200 text-gray-800'
                      : 'bg-gray-100 text-gray-600 italic' // System message style
                  }`}
                >
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="animate-pulse ml-2">...</span>
                  )}
                </div>
              </div>
            ))}
            {isLoading && !messages[messages.length - 1]?.isStreaming && ( // Only show if not streaming and still loading
              <div className="flex justify-start mb-4">
                <div className="max-w-[75%] px-4 py-2 rounded-lg shadow-sm text-sm bg-gray-200 text-gray-800">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-white flex items-center sticky bottom-0 w-full">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a business question..."
              className="flex-1 resize-none overflow-hidden h-auto max-h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base mr-2 bg-gray-50"
              rows={1}
              disabled={isLoading}
              aria-label="Chat input"
            />
            <button
              onClick={handleSendMessage}
              className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors duration-300 disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
              disabled={isLoading || input.trim() === ''}
              aria-label="Send message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotPopup;