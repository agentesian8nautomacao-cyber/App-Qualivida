export interface ChatMessage {
  role: 'user' | 'gemini' | 'system';
  content: string;
  isStreaming?: boolean; // Added for streaming messages
  isError?: boolean;
}
