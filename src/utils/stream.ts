import { v4 as uuidv4 } from 'uuid';
import { formatOpenAIStreamChunk } from './chat'; // Assuming formatOpenAIStreamChunk is in chat.ts

/**
 * Creates a TransformStream that formats a raw text stream into OpenAI-compatible Server-Sent Events.
 * @returns A TransformStream.
 */
export const createOpenAIStreamFormatter = (): TransformStream<string, Uint8Array> => {
    const chatCompletionId = `chatcmpl-${uuidv4()}`;

    return new TransformStream<string, Uint8Array>({
        start() {
            console.log("OpenAI Formatter TransformStream started.");
        },
        transform(chunk, controller) {
            try {
                controller.enqueue(new TextEncoder().encode(formatOpenAIStreamChunk(chatCompletionId, chunk)));
            } catch (error) {
                console.error("Error encoding/enqueuing chunk:", error);
                // Optionally, decide if the stream should terminate or just log the error.
            }
        },
        flush(controller) {
            try {
                // Send the final [DONE] marker for OpenAI compatibility
                controller.enqueue(new TextEncoder().encode(formatOpenAIStreamChunk(chatCompletionId, null, "stop")));
                console.log("OpenAI Formatter TransformStream finished.");
            } catch (error) {
                console.error("Error encoding/enqueuing final chunk:", error);
            }
        }
    });
}; 