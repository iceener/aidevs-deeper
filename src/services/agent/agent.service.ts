import type { CoreMessage } from "ai";
import type { TelemetryContext } from "../../types/telemetry";
import { resolve } from "./ai.service";
import { seek } from "./deep.service";
import { listSources } from "./sources.service";
import { createTask, updateTask, type Task, getTaskByThreadId } from "./tasks.service";
import { describeTaskSchema } from "@/ai/schemas/deep.schema";
import { describeTaskPrompt } from "@/ai/prompts/deep/describe-task.prompt";
import { decisionSchema } from "@/ai/schemas/agent.schema";
import { decisionPrompt } from "@/ai/prompts/agent/decision.prompt";
import { config } from "@/config/ai";
import { startSpan, endSpan } from "../core/telemetry.service";

type AgentToolHandler = (
  messages: CoreMessage[],
  threadId: number,
  controller: ReadableStreamDefaultController<string>,
  telemetry?: TelemetryContext
) => Promise<string>;

const agentTools: Array<{ name: string, handler: AgentToolHandler }> = [
  { name: 'access-sources', handler: getSources },
  { name: 'deep-search', handler: performDeepSearching }
];

export const think = async (
  messages: CoreMessage[], 
  threadId: number, 
  controller: ReadableStreamDefaultController<string>,
  telemetry?: TelemetryContext
): Promise<string> => {
  controller.enqueue("```block:reasoning|Thinking...\n\n");
  
  const maxSteps = 8;
  let step = 0;
  let context = '';
  let action: string | null = null;
  const initialContextLength = context.length; 

  let thinkTelemetry = telemetry;
  if (telemetry) {
    controller.enqueue(`Starting agent thinking process...\n\n`);
    thinkTelemetry = startSpan(telemetry, "agent-think-loop", { 
      threadId,
      startTime: new Date().toISOString(),
      initialMessageCount: messages.length,
      maxSteps,
    });
  }

  try {
    while (step < maxSteps && action !== 'provide-answer') {
      step++;
      controller.enqueue(`Starting step #${step}...\n\n`);
      
      if (!thinkTelemetry && telemetry) {
        thinkTelemetry = telemetry;
      }
      
      let stepTelemetry = thinkTelemetry;
      const stepContextLengthBefore = context.length; 
      if (thinkTelemetry) {
        stepTelemetry = startSpan(thinkTelemetry, `agent-step-${step}`, { 
          step,
          contextLengthBefore: stepContextLengthBefore
        });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      let toolTelemetry = stepTelemetry;
      let toolExecutionError: Error | null = null;
      let resultContext = '';
      let toolToExecute: { name: string, handler: AgentToolHandler } | undefined;

      try {
        // --- Step Logic ---
        action = await decide(messages, context, threadId, config.model, stepTelemetry);
        controller.enqueue(`Step #${step} action: **${action}**\n\n`);
        
        if (action === 'provide-answer') {
           break; 
        }

        toolToExecute = agentTools.find(t => t.name === action);
        if (!toolToExecute) {
          const errorMsg = `No handler found for action '${action}'`;
          controller.enqueue(`Warning: ${errorMsg}. Getting back to the user.\n\n`);
          toolExecutionError = new Error(errorMsg); 
          break; 
        }

        // --- Tool Execution Span Start ---
        if (stepTelemetry) { 
          toolTelemetry = startSpan(stepTelemetry, `agent-tool:${toolToExecute.name}`, {
            step,
            action, 
            threadId
          });
        }
        
        controller.enqueue(`Executing tool: ${toolToExecute.name}...\n\n`);
        
        // --- Await Tool Handler ---
        resultContext = await toolToExecute.handler(messages, threadId, controller, toolTelemetry); 
        const resultContextLength = resultContext?.length ?? 0;
        controller.enqueue(`Tool ${toolToExecute.name} finished. Result context length: ${resultContextLength}\n\n`);
        context += (context.length > 0 ? '\n\n' : '') + resultContext;

      } catch (error) {
        toolExecutionError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = toolExecutionError.message;
        const toolName = toolToExecute?.name || 'unknown tool'; // Use tool name if available
        console.error(`Error during agent step ${step} (tool: ${toolName}):`, toolExecutionError);
        controller.enqueue(`Error during step ${step} (tool: ${toolName}): ${errorMsg}\n\n`);
        break; 
      } finally {
        // --- Tool Execution Span End ---
        if (toolTelemetry && toolTelemetry.currentSpan) { 
           if (toolExecutionError) {
               toolTelemetry = await Promise.resolve(endSpan(toolTelemetry, null, toolExecutionError));
           } else if (action !== 'provide-answer' && toolToExecute) {
               toolTelemetry = await Promise.resolve(endSpan(toolTelemetry, {
                   resultContextLength: resultContext?.length ?? 0,
               }));
           } 
        }

        // --- Step Span End ---
        if (stepTelemetry) {
           let stepOutput: Record<string, any> = {
               action: action || 'unknown',
               contextLengthAfter: context.length,
               contextDelta: context.length - stepContextLengthBefore
           };
           let stepError: Error | null = null;

           if (toolExecutionError) { // If an error occurred anywhere in the 'try' block
               stepOutput.outcome = toolToExecute ? 'tool-error' : 'tool-not-found'; // Distinguish tool error vs lookup error
               stepOutput.toolName = toolToExecute?.name;
               stepOutput.error = toolExecutionError.message;
               stepError = toolExecutionError;
           } else if (action === 'provide-answer') {
               stepOutput.outcome = 'provide-answer';
           } else {
               stepOutput.outcome = 'tool-completed';
               stepOutput.toolName = toolToExecute?.name;
           }
          
           stepTelemetry = await Promise.resolve(endSpan(stepTelemetry, stepOutput, stepError));
        }
      } // End of try...finally for step

      // Break loop if an error occurred during the step/tool execution
      if (toolExecutionError) {
          break;
      }

      await new Promise(resolve => setTimeout(resolve, 30));
    } // End while loop
  } finally {
    // End the overall agent-think-loop span
    if (thinkTelemetry) {
      thinkTelemetry = await Promise.resolve(endSpan(thinkTelemetry, {
        totalStepsExecuted: step, 
        finalAction: action, // Last action decided or attempted
        finalContextLength: context.length,
        totalContextDelta: context.length - initialContextLength, 
        endTime: new Date().toISOString()
      }));
    }
  }

  controller.enqueue('\n```\n\n');
  return context;
}

export const decide = async (
  messages: CoreMessage[], 
  context: string, 
  threadId: number, 
  model = config.model,
  telemetry?: TelemetryContext
) => {

  const task = await getTaskByThreadId(threadId);

  const {action, _thinking} = await resolve({
    messages: [...messages, { role: 'user', content: 'Do not answer me directly. Please decide what to do next. Consider the context if available.' }],
    system: decisionPrompt(context, task),
    schema: decisionSchema,
    model,
    telemetry,
    generationName: "agent-decide-generation" // Use a specific name for the generation
  });

  console.log('🔍 Action:', action, _thinking);

  return action;
}

export const describeTask = async (task: Task, messages: CoreMessage[], telemetry?: TelemetryContext) => {
  try {
    const taskDescription = await resolve({
      messages,
      system: describeTaskPrompt,
      schema: describeTaskSchema,
      telemetry,
      generationName: "deep-describe-task-generation"
    });

    if (!taskDescription || !taskDescription.name) { // Check for name presence as it seems essential
      console.error("Failed to generate a valid task description.", taskDescription);
      const error = new Error("Failed to describe task: Invalid description generated.");
      throw error;
    }

    await updateTask(task.id, { 
      name: taskDescription.name, 
      description: taskDescription.description, 
      context: taskDescription.context 
    });

    return taskDescription;
  } catch (error) {
    console.error(`Error describing task ${task.id}:`, error);
    throw error;
  }
}


async function getSources(
  _messages: CoreMessage[], 
  _threadId: number, 
  controller: ReadableStreamDefaultController<string>,
  telemetry?: TelemetryContext
): Promise<string> {
  const sourcesTelemetry = telemetry;
  let sourceCount = 0;
  let documentCount = 0;
  let result = '';

  try {
    controller.enqueue("Accessing sources...\n\n");
    const sources = await listSources();
    sourceCount = sources.length;
    documentCount = sources.reduce((sum, src) => sum + (src.documents?.length ?? 0), 0);
    
    if (sources.length > 0) {
      const sourceStrings = sources.map(source => {
        let docList = '';
        if (source.documents && source.documents.length > 0) {
          const docItems = source.documents.map(doc => `    - \`${doc.name}\` (UUID: ${doc.uuid})`).join('\n');
          docList = `\n  - Documents:\n${docItems}`;
        } else {
          docList = '\n  - (No documents loaded)';
        }
        return `- **${source.name}** (Origin: \`${source.origin}\`, UUID: ${source.uuid})${docList}`;
      });
      
      result = `**Available Sources (${sourceCount}):**\n\n${sourceStrings.join('\n\n')}`;
      
      return result;
    } else {
      result = "No sources found.";
      controller.enqueue(result + "\n\n");
      return result;
    }
  } catch (error) {
    throw error;
  }
};

async function performDeepSearching(
  messages: CoreMessage[], 
  threadId: number, 
  controller: ReadableStreamDefaultController<string>,
  telemetry?: TelemetryContext
): Promise<string> {
  const deepSearchTelemetry = telemetry; 

  try {
    let task = await getTaskByThreadId(threadId);
    if (!task) {
      await createTask({ name: 'Deep Search Task', thread_id: threadId });
      task = await getTaskByThreadId(threadId);
      controller.enqueue(`Task created\n\n`);
    }

    if (!task) {
      const error = new Error("Failed to create task.");
      throw error; 
    }

    await describeTask(task, messages, deepSearchTelemetry); 
    controller.enqueue(`Task updated with name: ${task.name}\n\n`);
    
    const result = await seek(messages, { 
      threadId, 
      taskId: task.id, 
      controller 
    }, deepSearchTelemetry); 

    return result?.message ?? "Deep seeking finished but could not find any result. Please inform the user.";
  } catch (error) {
    console.error("Error during deep seeking:", error);
    controller.enqueue(`Error during deep seeking: ${error instanceof Error ? error.message : String(error)}\n`);
    
    throw error; 
  }
}