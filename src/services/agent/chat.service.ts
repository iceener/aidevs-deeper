import type { ChatRequestBody } from '../../types/ai';
import type { TelemetryContext } from '../../types/telemetry';
import type { CoreMessage } from 'ai';

import * as threadService from './../database/threads.service';
import * as messageService from './../database/messages.service';
import { getDocumentsByThreadId, type Document } from './../database/documents.service';

import { config } from '@/config/ai';
import { think } from './agent.service';
import { streamCompletion } from './ai.service';
import { extractChatComponents, extractLatestUserMessageContent } from '../../utils/chat';
import { mainPrompt } from '@/ai/prompts/agent/main.prompt';
import { getTaskByThreadId } from './tasks.service';
import { startTraceContext, startSpan, endSpan, trackEvent } from '../core/telemetry.service';

export function processChatTurn(body: ChatRequestBody): ReadableStream<string> {
    const { conversation_id: threadUuid, messages: incomingMessages } = body;

    const customStream = new ReadableStream<string>({
        async start(controller) {
            let threadId: number | null = null; // To store threadId for later saving
            let finalResponse = ''; // Accumulator for the AI response
            let telemetry: TelemetryContext | null = null;

            try {
                // Initialize telemetry trace for this chat turn, using threadUuid as sessionId
                telemetry = startTraceContext({ name: "chat-request", sessionId: threadUuid });

                // 1. Ensure thread exists (as an event, not a span)
                const { id: newThreadId } = await threadService.getOrCreateThread(threadUuid);
                threadId = newThreadId;

                // 2. Process and save user message (as an event)
                const userMessage = extractLatestUserMessageContent(incomingMessages);
                await messageService.createMessage({ threadId, role: 'user', content: userMessage });

                // 3. Prepare for AI calls
                const { system, messages } = extractChatComponents(incomingMessages);
                
                // Explicitly handle the type conversion
                const coreMessages = messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })) as CoreMessage[];
                
                let aiParams = { model: config.model, system, messages: coreMessages };

                // 4. Call the agent's think function directly
                // The think function now creates its own spans internally
                // Ensure that telemetry is properly passed through
                const context = await think(coreMessages, threadId, controller, telemetry);

                // Get task if exists and generate system prompt
                const task = await getTaskByThreadId(threadId);
                const systemPrompt = mainPrompt(context, task);
                
                // 5. Generate final response
                // The streamCompletion function will create its own generation
                const aiStream = await streamCompletion({
                    ...aiParams, 
                    system: systemPrompt,
                    telemetry,
                    // Pass a specific name for the generation
                    generationName: "final-response-generation",
                });
                
                // 6. Read AI stream, enqueue chunks, and accumulate content
                const reader = aiStream.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    controller.enqueue(value);
                    finalResponse += value;
                }
                reader.releaseLock(); 

                // 7. Save the complete AI response (as an event)
                if (finalResponse && threadId !== null) {
                    try {
                        await messageService.createMessage({ 
                            threadId, 
                            role: 'assistant', 
                            content: finalResponse 
                        });
                    } catch (saveError) {
                        if (telemetry) {
                            trackEvent(telemetry, "save-assistant-message-error", 
                                { contentPreview: finalResponse.substring(0, 500) }, // input
                                { error: String(saveError) }, // output
                                { contentLength: finalResponse.length } // metadata
                            );
                        }
                        controller.error(new Error("Failed to save assistant response"));
                    }
                }

                // 8. Close the custom stream
                controller.close();
            } catch (error) {
                console.error("[chat.service customStream] Error during stream processing:", error);
                
                // Record error in telemetry if available
                if (telemetry) {
                    // End any active span with the error
                    if (telemetry.currentSpan) {
                        telemetry = endSpan(telemetry, null, error);
                    }
                    
                    // Track error event
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error(`Marking telemetry trace as failed: ${errorMessage}`);
                    trackEvent(telemetry, "chat-processing-error", 
                        { threadId, messageCount: incomingMessages.length }, // input
                        { error: errorMessage, stack: error instanceof Error ? error.stack : undefined }, // output
                        {} // metadata
                    );
                }
                
                controller.error(error);
                
                if (threadId !== null) {
                    try {
                        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during streaming.";
                         await messageService.createMessage({ threadId, role: 'assistant', content: `Error: ${errorMessage}` });
                    } catch (saveError) {
                         console.error(`[chat.service customStream] Also failed to save error message for thread ${threadId}:`, saveError);
                    }
                }
            }
        }
    });

    return customStream;
}