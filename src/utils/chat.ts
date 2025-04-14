import type { CoreMessage, TextContent, ChatRequestBody } from "../types/ai";

export const formatOpenAIStreamChunk = (id: string, content: string | null, finishReason: string | null = null): string => {
    const delta: { content?: string; role?: string } = {};
    if (content !== null) {
        delta.content = content;
    }
    
    const chunk = {
      id: id,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: "gpt-model-placeholder", // TODO: Replace with actual model used if available
      choices: [
        {
          index: 0,
          delta: delta,
          finish_reason: finishReason,
        },
      ],
    };
    return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * Extracts system prompt and user messages from chat thread
 */
export const extractChatComponents = (thread: CoreMessage[]) => {
  const systemMessage = thread.find((message) => message.role === 'system');
  const system = systemMessage?.content && typeof systemMessage.content !== 'string' 
    ? (systemMessage.content as TextContent[])[0]?.text 
    : systemMessage?.content as string | undefined;
  
  const messages = thread.filter((message) => message.role !== 'system');
  
  return { system, messages };
};

/**
 * Extracts the text content from the latest user message in an array.
 * @param messages - The array of messages from the request body.
 * @returns The text content of the latest user message.
 * @throws Error if no user message is found or content is unsupported.
 */
export function extractLatestUserMessageContent(messages: ChatRequestBody['messages']): string {
     const latestUserMessage = [...messages].reverse().find(msg => msg.role === 'user');

    if (!latestUserMessage) {
        throw new Error("No user message found in the request.");
    }

     // Extract text content - adjust if structure is different
    if (typeof latestUserMessage.content === 'string') {
        return latestUserMessage.content;
    } else if (Array.isArray(latestUserMessage.content) && latestUserMessage.content.length > 0 && latestUserMessage.content[0].type === 'text') {
        return latestUserMessage.content[0].text;
    } else {
        console.warn("Could not extract text from the latest user message:", latestUserMessage);
        throw new Error("Unsupported user message format.");
    }
} 