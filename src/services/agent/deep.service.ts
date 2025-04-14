import type { Tool } from "@/types/deep";
import type { CoreMessage } from "ai";
import type { TelemetryContext } from "../../types/telemetry";
import { z } from "zod";

import { getTaskById, type TaskWithRelations, linkTaskToSources, linkTaskToDocuments, updateTask, type Task } from "./tasks.service";
import { createStep, updateStep } from "./steps.service";
import { connectDocumentsSchema, connectSourcesSchema, generateOutlineSchema, generateResultSchema, reflectSchema, takeNotesSchema } from "@/ai/schemas/deep.schema";
import { resolve } from "./ai.service";
import { reflectPrompt } from "@/ai/prompts/deep/reflect.prompt";
import { connectSourcesPrompt } from "@/ai/prompts/deep/connect-sources.prompt";
import { listSources } from "./sources.service";
import { augmentLocalDocumentsWithContent, listDocuments, type Document, createGeneratedDocument, augmentExternalDocumentsWithContent, type AugmentedDocument } from "../database/documents.service";
import { connectDocumentsPrompt } from "@/ai/prompts/deep/connect-documents.prompt";
import { takeNotesPrompt } from "@/ai/prompts/deep/take-notes.prompt";
import { createMultipleNotes, type NewNote } from "./notes.service";
import { generateOutlinePrompt } from "@/ai/prompts/deep/generate-outline.prompt";
import { generateResultPrompt } from "@/ai/prompts/deep/generate-result.prompt";
import { createResultEntry } from "../database/results.service";
import { startSpan, endSpan } from "../core/telemetry.service";
import { config } from "@/config/ai";

// Define a type for tool handlers that can receive telemetry
type ToolHandler = (
    messages: CoreMessage[],
    task: TaskWithRelations,
    telemetry?: TelemetryContext
) => Promise<string>;

// Define the type for a section based on the Zod schema inference
type Section = z.infer<typeof generateResultSchema>['sections'][number];

const tools: Array<{ name: string, description: string, handler: ToolHandler }> = [
    { name: 'connect-sources', description: 'Connect the relevant sources', handler: connectSources },
    { name: 'connect-documents', description: 'Connect the relevant documents', handler: connectDocuments },
    { name: 'take-notes', description: 'Take notes from the documents', handler: takeNotes },
    { name: 'generate-outline', description: 'Generate an outline for the final document based on the notes you have', handler: generateOutline },
    { name: 'generate-result', description: 'Generate a result for the final document based on the outline and notes you have', handler: generateResult },
    // finish does not need a handler, it's just a tool to finish the task
    { name: 'finish', description: 'Use this when you have no more steps to perform or you finished the task', handler: async () => Promise.resolve('') },
]

export const seek = async (
    messages: CoreMessage[], 
    context: { threadId: number, taskId: number, controller: ReadableStreamDefaultController<string> },
    telemetry?: TelemetryContext
) => {
    const initialTask = await getTaskById(context.taskId); // Fetch task once at start
    if (!initialTask) {
        throw new Error(`Task ${context.taskId} not found at seek start`);
    }

    context.controller.enqueue("Starting deep search process...\n\n");
    
    const maxSteps = 10;
    let step = 0;
    let action: string | null = null;
    let message = ''; // Final message for the user if needed

    let seekTelemetry = telemetry;
    if (seekTelemetry) {
        seekTelemetry = startSpan(seekTelemetry, "deep-seek-loop", {
            taskId: context.taskId, 
            threadId: context.threadId,
            taskName: initialTask.name, // Add initial task name
            maxSteps,
            startTime: new Date().toISOString()
        });
        await new Promise(resolve => setTimeout(resolve, 20));
    }

    try {
        while (step < maxSteps && action !== 'finish') {
            step++;
            context.controller.enqueue(`Starting deep step #${step}...\n\n`);
            
            if (!seekTelemetry && telemetry) {
                seekTelemetry = telemetry;
            }
            
            let stepTelemetry = seekTelemetry;
            if (stepTelemetry) {
                // Add metadata about the task state *before* the step
                const taskBeforeStep = await getTaskById(context.taskId); 
                stepTelemetry = startSpan(stepTelemetry, `deep-step-${step}`, { 
                    step,
                    taskStatusBefore: taskBeforeStep?.status,
                    noteCountBefore: taskBeforeStep?.notes?.length ?? 0,
                    documentLinkCountBefore: taskBeforeStep?.tasksToDocuments?.length ?? 0,
                    sourceLinkCountBefore: taskBeforeStep?.tasksToSources?.length ?? 0,
                    hasOutlineBefore: !!taskBeforeStep?.outline,
                });
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            let currentTask = await getTaskById(context.taskId); // Fetch task state for this step
            if (!currentTask) {
                const error = new Error(`Task ${context.taskId} not found at step ${step}`);
                if (stepTelemetry) {
                    stepTelemetry = await Promise.resolve(endSpan(stepTelemetry, { outcome: 'task-not-found', error: error.message }, error));
                }
                throw error;
            }

            try {
                // Reflection (creates deep-reflect-generation internally)
                const reflection = await reflect(messages, currentTask, stepTelemetry); 
                action = reflection.tool; // Update action based on reflection
                context.controller.enqueue(`Step #${step} reflected action: **${action}** (Request: ${reflection.request.substring(0, 100)}...)\n\n`);

                if (action === 'contact-user') {
                    message = `⚠️ Contact with the user is needed! Reason: ${reflection.request}. Don't proceed but contact the user.`;
                    context.controller.enqueue(message + "\n\n");
                    if (stepTelemetry) {
                        stepTelemetry = await Promise.resolve(endSpan(stepTelemetry, {
                            action, // 'contact-user'
                            request: reflection.request,
                            outcome: 'contact-user' 
                        }));
                    }
                    break; // Exit loop
                }

                if (action === 'finish') {
                    context.controller.enqueue("Step decided to finish.\n\n");
                     if (stepTelemetry) {
                        stepTelemetry = await Promise.resolve(endSpan(stepTelemetry, {
                            action, // 'finish'
                            request: reflection.request, // Capture finish reason if any
                            outcome: 'finish'
                        }));
                    }
                    break; // Exit loop
                }
                
                const tool = tools.find(t => t.name === action);
                if (!tool) {
                    const error = new Error(`Tool '${action}' not found`);
                    if (stepTelemetry) {
                        stepTelemetry = await Promise.resolve(endSpan(stepTelemetry, {
                            action,
                            request: reflection.request,
                            outcome: "tool-not-found",
                            error: error.message
                        }, error));
                    }
                    throw error; // Re-throw to exit the loop
                }

                // Execute Tool
                let toolTelemetry = stepTelemetry;
                if (toolTelemetry) {
                    toolTelemetry = startSpan(toolTelemetry, `deep-tool:${tool.name}`, {
                        taskId: currentTask.id,
                        request: reflection.request // Pass the specific request for this tool execution
                    });
                }

                // DB Step Record (Consider adding an event here if DB timing is critical)
                const taskStep = await createStep({ 
                    task_id: currentTask.id, 
                    name: tool.name, 
                    request: reflection.request, 
                    results: 'Processing...' // Initial status
                });
                
                if (!taskStep) {
                    const error = new Error(`Failed to create task step record for tool ${tool.name}`);
                    if (toolTelemetry) { toolTelemetry = await Promise.resolve(endSpan(toolTelemetry, null, error)); }
                    if (stepTelemetry) {
                        stepTelemetry = await Promise.resolve(endSpan(stepTelemetry, {
                            action, request: reflection.request, outcome: "step-creation-failed", error: error.message
                        }, error));
                    }
                    throw error; // Re-throw to exit the loop
                }

                let toolResult = '';
                try {
                    toolResult = await tool.handler(messages, currentTask, toolTelemetry); 
                    context.controller.enqueue(`Tool ${tool.name} finished. Result: ${toolResult.substring(0, 200)}...\n\n`);
                    
                    await updateStep(taskStep.id, {
                        results: toolResult || 'Completed successfully.', // Use placeholder if empty
                    });
                    
                    if (toolTelemetry) {
                        toolTelemetry = await Promise.resolve(endSpan(toolTelemetry, {
                             // Add tool-specific outputs here based on the handler's logic if possible
                            resultSummary: toolResult?.substring(0, 200), 
                            stepId: taskStep.id
                        }));
                    }
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    console.error(`Error executing deep tool ${tool.name} (step ID ${taskStep?.id}):`, error);
                    
                    if (toolTelemetry) { toolTelemetry = await Promise.resolve(endSpan(toolTelemetry, null, error)); }
                    if(taskStep?.id) { // Update step only if created
                       await updateStep(taskStep.id, { results: `Error: ${errorMsg}` });
                    }
                    
                    if (stepTelemetry) {
                        stepTelemetry = await Promise.resolve(endSpan(stepTelemetry, {
                            action, request: reflection.request, outcome: "tool-error", toolName: tool.name, stepId: taskStep?.id, error: errorMsg
                        }, error));
                    }
                    throw error; // Re-throw to exit the loop
                }
                
                // End Step Span (Success)
                // Get updated task status after the tool ran
                const taskAfterStep = await getTaskById(context.taskId);
                if (stepTelemetry) {
                    stepTelemetry = await Promise.resolve(endSpan(stepTelemetry, {
                        action, // Tool that ran
                        request: reflection.request, // Tool request
                        outcome: 'tool-completed',
                        toolName: tool.name,
                        stepId: taskStep.id,
                        resultSummary: toolResult?.substring(0, 200),
                        taskStatusAfter: taskAfterStep?.status, // Add post-step task status
                        noteCountAfter: taskAfterStep?.notes?.length ?? 0,
                        documentLinkCountAfter: taskAfterStep?.tasksToDocuments?.length ?? 0,
                        sourceLinkCountAfter: taskAfterStep?.tasksToSources?.length ?? 0,
                        hasOutlineAfter: !!taskAfterStep?.outline,
                    }));
                }

                await new Promise(resolve => setTimeout(resolve, 30));
                
            } catch (error) { // Catches errors from reflection, tool finding, tool execution
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`Error processing deep seek step ${step} for task ${context.taskId}:`, error);
                
                // Ensure the step span is ended, only check if span exists
                if (stepTelemetry && stepTelemetry.currentSpan) { 
                     stepTelemetry = await Promise.resolve(endSpan(stepTelemetry, {
                        action: action || 'unknown',
                        outcome: 'step-error',
                        error: errorMsg
                     }, error));
                }
                break; // Exit the loop on any step error
            }
        } // End while loop
    } finally {
        // Always end the overall seek loop span
        const finalTask = await getTaskById(context.taskId); // Get final task state
        if (seekTelemetry) {
            seekTelemetry = await Promise.resolve(endSpan(seekTelemetry, {
                totalStepsExecuted: step,
                finalAction: action, // Last action attempted or 'finish'
                finalMessageToUser: message, // Include message if user contact needed
                finalTaskStatus: finalTask?.status, // Add final task status
                finalNoteCount: finalTask?.notes?.length ?? 0,
                finalDocumentLinkCount: finalTask?.tasksToDocuments?.length ?? 0,
                finalSourceLinkCount: finalTask?.tasksToSources?.length ?? 0,
                finalHasOutline: !!finalTask?.outline,
                endTime: new Date().toISOString()
            }));
        }
    }

    // Return message if user contact is needed, otherwise empty/null
    return {
        message: action === 'contact-user' ? message : null, 
    };
}

export const reflect = async (
    messages: CoreMessage[], 
    task: TaskWithRelations,
    telemetry?: TelemetryContext
): Promise<{ tool: string, request: string }> => {
    try {
        const { _thinking, tool, request } = await resolve({
            messages: [...messages, { role: 'user', content: 'Do not answer me directly. Please decide what to do next. Consider the context if available.' }],
            system: reflectPrompt(task, tools),
            schema: reflectSchema,
            telemetry,
            generationName: "deep-reflect-generation" // Specific name for clarity
        });

        console.log(`Reflection: ${JSON.stringify(_thinking)}`);
        
        return { tool, request };
    } catch (error) {
        console.error(`Error during reflection for task ${task.id}:`, error);
        throw error;
    }
}

async function connectSources(
    messages: CoreMessage[], 
    task: TaskWithRelations,
    telemetry?: TelemetryContext
) {
    const sourceTelemetry = telemetry;
    
    try {
        const sources = await listSources();
        
        const { _thinking, sources: sourceUuids } = await resolve<typeof connectSourcesSchema> ({
            messages,
            system: connectSourcesPrompt(task, sources),
            schema: connectSourcesSchema,
            telemetry: sourceTelemetry,
            generationName: "connect-sources-resolve"
        });

        console.log(`_thinking (connectSources): ${_thinking}`);
        console.log(`Source UUIDs resolved: ${sourceUuids.join(', ')}`);

        if (!sourceUuids || sourceUuids.length === 0) {
            console.log(`No source UUIDs returned by resolve for task ${task.id}.`);
            return "No relevant sources identified to connect.";
        }

        try {
            console.log(`Linking task ${task.id} to sources: ${sourceUuids.join(', ')}`);
            await linkTaskToSources(task.id, sourceUuids);
            
            const result = `Connected ${sourceUuids.length} source(s) to task ${task.id}.`;
            
            return result;
        } catch (error) {
            console.error(`Error linking task ${task.id} to sources:`, error);
            throw error;
        }
    } catch (error) {
        throw error;
    }
}

async function connectDocuments(
    messages: CoreMessage[], 
    task: TaskWithRelations,
    telemetry?: TelemetryContext
): Promise<string> {
    const docTelemetry = telemetry;
    
    try {
        const allDocuments = await listDocuments();
        if (!allDocuments || allDocuments.length === 0) {
            const result = "No documents found in the system to connect.";
            return result;
        }

        const { _thinking, documents: documentUuids } = await resolve<typeof connectDocumentsSchema> ({
            messages,
            system: connectDocumentsPrompt(task, allDocuments),
            schema: connectDocumentsSchema,
            telemetry: docTelemetry,
            generationName: "connect-documents-resolve"
        });

        console.log(`_thinking (connectDocuments): ${_thinking}`);
        console.log(`Document UUIDs resolved: ${documentUuids.join(', ')}`);

        if (!documentUuids || documentUuids.length === 0) {
            console.log(`No document UUIDs returned by resolve for task ${task.id}.`);
            const result = "No relevant documents identified to connect.";
            return result;
        }

        try {
            console.log(`Linking task ${task.id} to documents: ${documentUuids.join(', ')}`);
            await linkTaskToDocuments(task.id, documentUuids);
            
            const result = `Connected ${documentUuids.length} document(s) to task ${task.id}.`;
            
            return result;
        } catch (error) {
            console.error(`Error linking task ${task.id} to documents:`, error);
            throw error;
        }
    } catch (error) {
        throw error;
    }
}

async function takeNotes(
    messages: CoreMessage[], 
    task: TaskWithRelations,
    telemetry?: TelemetryContext
) {
    const notesTelemetry = telemetry;
    
    try {
        let processDocsTelemetry = notesTelemetry;
        if (processDocsTelemetry) {
            processDocsTelemetry = startSpan(processDocsTelemetry, "process-documents", {
                documentCountInitial: task.tasksToDocuments.length
            });
        }
        
        let augmentedDocuments: AugmentedDocument[] = [];
        let localCount = 0;
        let externalCount = 0;
        try {
            const documents = task.tasksToDocuments.map(d => d.document);
            const localDocuments = (await augmentLocalDocumentsWithContent(documents.filter(d => d.type === 'local')));
            const externalDocuments = (await augmentExternalDocumentsWithContent(documents.filter(d => d.type === 'external'), task));
            augmentedDocuments = [...localDocuments, ...externalDocuments];
            localCount = localDocuments.length;
            externalCount = externalDocuments.length;

            if (processDocsTelemetry) {
                processDocsTelemetry = endSpan(processDocsTelemetry, {
                    localCount: localCount,
                    externalCount: externalCount,
                    totalAugmentedCount: augmentedDocuments.length
                });
            }
        } catch (prepError) {
             console.error(`Error preparing documents for task ${task.id}:`, prepError);
             if (processDocsTelemetry) {
                 processDocsTelemetry = endSpan(processDocsTelemetry, null, prepError);
             }
             throw prepError;
        }

        const notePromises = augmentedDocuments.map(async (document) => {
            let docTelemetry = notesTelemetry;
            if (docTelemetry) {
                docTelemetry = startSpan(docTelemetry, `process-document-${document.uuid.substring(0, 8)}`, {
                    documentId: document.id,
                    documentUuid: document.uuid,
                    documentType: document.type,
                    documentName: document.name?.substring(0, 100)
                });
            }
            
            try {
                const { _thinking, notes: extractedNotes } = await resolve({
                    messages: [...messages, { role: 'user', content: 'Do not answer me directly but focus on the task. Keep in mind extdracting links and images if they are present in the document. Write back with valid JSON string.' }],
                    system: takeNotesPrompt(task, document),
                    schema: takeNotesSchema,
                    model: config.gemini_model,
                    telemetry: docTelemetry,
                    generationName: `take-notes-process-doc-${document.uuid.substring(0, 8)}`
                });
                
                const docNotes = extractedNotes.map((note: { query: string; content: string }) => ({  
                    task_id: task.id,
                    document_id: document.id,
                    source_id: document.source_id,
                    query: note.query,
                    content: note.content,
                }));
                
                if (docTelemetry) {
                    docTelemetry = endSpan(docTelemetry, {
                        extractedNoteCount: docNotes.length
                    });
                }
                
                return docNotes;
            } catch (error) {
                if (docTelemetry) {
                    docTelemetry = endSpan(docTelemetry, null, error);
                }
                console.error(`Error processing document ${document.uuid}:`, error);
                return [{
                    task_id: task.id,
                    document_id: document.id,
                    source_id: document.source_id,
                    query: `Error processing document ${document.uuid}`,
                    content: `Error processing document ${document.uuid}: ${error instanceof Error ? error.message : String(error)}. Please inform the user.`
                }];
            }
        });
        
        const settledNotes = await Promise.allSettled(notePromises);

        const notesToInsert: NewNote[] = [];
        let successfulDocs = 0;
        let failedDocs = 0;

        settledNotes.forEach(result => {
            if (result.status === 'fulfilled') {
                notesToInsert.push(...result.value);
                if (result.value.length === 1 && result.value[0].query.startsWith('Error processing document')) {
                    failedDocs++;
                } else {
                    successfulDocs++;
                }
            } else {
                console.error("Unhandled promise rejection in takeNotes processing:", result.reason);
                failedDocs++;
                notesToInsert.push({
                    task_id: task.id,
                    document_id: -1,
                    source_id: null,
                    query: "Unhandled Processing Error",
                    content: `An unexpected error occurred: ${result.reason}`
                });
            }
        });

        if (notesToInsert.length === 0 && failedDocs === 0) {
            console.log(`No notes were extracted for task ${task.id}.`);
            const result = "No notes were extracted from the documents.";
            return result;
        }

        const savedNotes = await createMultipleNotes(notesToInsert);
        
        const result = `Processed ${successfulDocs} document(s) successfully, ${failedDocs} failed. Saved ${savedNotes.length} notes (including error markers).`;
        return result;
        
    } catch (error) {
        console.error(`Critical error during takeNotes for task ${task.id}:`, error);
        throw error; 
    }
}

async function generateOutline(
    messages: CoreMessage[], 
    task: TaskWithRelations,
    telemetry?: TelemetryContext
) {
    try {
        const { _thinking, outline } = await resolve({
            messages,
            system: generateOutlinePrompt(task),
            schema: generateOutlineSchema,
            telemetry,
            model: config.gemini_model,
            generationName: "deep-generate-outline-generation"
        });

        console.log(`_thinking (generateOutline): ${_thinking}`);
        console.log(`Outline generated: ${outline.substring(0, 200)}...`);

        await updateTask(task.id, {
            outline: outline
        });
        
        return `Outline generated and saved to task ${task.id}. Length: ${outline.length}`;
    } catch (error) {
        console.error(`Error generating outline for task ${task.id}:`, error);
        throw error;
    }
}

async function generateResult(
    messages: CoreMessage[], 
    task: TaskWithRelations,
    telemetry?: TelemetryContext
) {
    const resultTelemetry = telemetry;
    
    try {
        const { _thinking, sections } = await resolve({
            messages: [...messages, { role: 'user', content: 'Do not answer me directly but focus on the task. Keep in mind the priority that is to write section for EVERY SINGLE OUTLINE POINT. Do not skip any of them. You\'re forced to write back with array of sections that covers ALL OF THEM' }],
            system: generateResultPrompt(task),
            schema: generateResultSchema,
            telemetry: resultTelemetry,
            model: config.gemini_model,
            generationName: "generate-result-resolve"
        });

        console.log(`_thinking (generateResult): ${_thinking}`);
        console.table(`♥️`, sections.map((s: Section) => ({ title: s.title, commentary: s.commentary?.substring(0,50) })));

        let markdownContent = `# ${task.name || 'Deep Search Result'}\n\n`;
        if (task.description) {
            markdownContent += `${task.description}\n\n---\n\n`;
        }

        sections.forEach((section: Section) => {
            markdownContent += `## ${section.title}\n\n`;
            markdownContent += `${section.content}\n\n`;
            if (section.commentary) {
                markdownContent += `_Commentary:_\n> ${section.commentary.replace(/\n/g, '\n> ')}\n\n`;
            }
            markdownContent += '---\n\n';
        });
        
        let saveTelemetry = resultTelemetry;
        if (saveTelemetry) {
            saveTelemetry = startSpan(saveTelemetry, "save-result-document", {
                markdownLength: markdownContent.length,
                sectionCount: sections.length
            });
        }

        let generatedDocument: Document | undefined;
        try {
            generatedDocument = await createGeneratedDocument(markdownContent, task.id);

            if (!generatedDocument) {
                throw new Error('Failed to create generated document record.');
            }

            console.log(`Generated document created with ID: ${generatedDocument.id} and UUID: ${generatedDocument.uuid}`);

            await createResultEntry(task.id, generatedDocument.id);
            console.log(`Result entry created linking task ${task.id} to document ${generatedDocument.id}`);

            await updateTask(task.id, { status: 'completed' });
            console.log(`Task ${task.id} status updated to completed.`);
            
            if (saveTelemetry) {
                saveTelemetry = endSpan(saveTelemetry, {
                    documentId: generatedDocument.id,
                    documentUuid: generatedDocument.uuid,
                    status: 'completed'
                });
            }
            
            const result = `Generated document saved (UUID: ${generatedDocument.uuid}) and task marked as completed. Sections: ${sections.length}.`;
            return result;

        } catch (error) {
            if (saveTelemetry) {
                saveTelemetry = endSpan(saveTelemetry, null, error);
            }
            
            console.error(`Error during result saving/finalization for task ${task.id}:`, error);
            try {
                await updateTask(task.id, { status: 'failed' });
                 console.log(`Task ${task.id} status updated to failed due to save error.`);
            } catch (updateError) {
                console.error(`Also failed to update task ${task.id} status to failed:`, updateError);
            }
            
            throw error;
        }
    } catch (error) {
        console.error(`Error generating result for task ${task.id}:`, error);
         try {
             const currentTaskStatus = await getTaskById(task.id);
             if (currentTaskStatus && currentTaskStatus.status !== 'failed') {
                 await updateTask(task.id, { status: 'failed' });
                 console.log(`Task ${task.id} status updated to failed due to generation error.`);
             }
         } catch (updateError) {
             console.error(`Also failed to update task ${task.id} status to failed after generation error:`, updateError);
         }
        throw error;
    }
}