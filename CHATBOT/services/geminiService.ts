import { GoogleGenAI, Chat } from "@google/genai";
import { ChatMessage } from '../types';

let chatSession: Chat | undefined;
const SYSTEM_INSTRUCTION = "You are a helpful business management expert, providing clear and concise answers to questions about business strategy, operations, finance, and marketing. Keep responses focused on business management topics.";
const MODEL_NAME = 'gemini-2.5-flash';

// Ensure the GoogleGenAI instance is created right before an API call
// to use the most up-to-date API key.
function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export async function initializeChat(): Promise<void> {
  if (!chatSession) {
    const ai = getGeminiClient();
    chatSession = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });
  }
}

export async function sendMessageToGemini(
  message: string,
  onNewChunk: (chunk: string) => void,
  onError: (error: string) => void,
): Promise<void> {
  if (!chatSession) {
    await initializeChat(); // Ensure chat session is initialized
  }

  if (!chatSession) {
    onError("Chat session could not be initialized.");
    return;
  }

  try {
    const responseStream = await chatSession.sendMessageStream({ message: message });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        onNewChunk(chunk.text);
      }
    }
  } catch (error: any) {
    console.error("Gemini API error:", error);
    onError(`Failed to get response from Gemini: ${error.message || 'Unknown error'}`);
    // If the API key is invalid or a fundamental issue, we might need to recreate the session.
    // For now, just report the error.
  }
}

// Function to reset the chat session if needed (e.g., for starting a new conversation context)
export function resetChatSession(): void {
  chatSession = undefined;
  // A new session will be created on the next message
}
