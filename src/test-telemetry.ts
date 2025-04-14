import { streamCompletion, completion, resolve } from "./services/agent/ai.service";
import { z } from "zod";

const testSchema = z.object({
  summary: z.string().describe("Brief summary of the input"),
  keyPoints: z.array(z.string()).describe("Key points from the text"),
});

async function runTests() {
  console.log("Testing Langfuse integration...");

  try {
    console.log("Testing completion...");
    const completionResult = await completion({
      messages: [
        {
          role: "user",
          content: "What is Langfuse and how does it help with LLM observability?",
        },
      ],
      system: "You are a helpful AI assistant that provides concise answers.",
    });
    console.log("Completion result:", completionResult.substring(0, 100) + "...");

    console.log("\nTesting streamCompletion...");
    const stream = await streamCompletion({
      messages: [
        {
          role: "user",
          content: "Explain how to implement telemetry for LLM applications",
        },
      ],
      system: "You are a helpful AI assistant that provides concise answers.",
    });

    console.log("Reading stream...");
    const reader = stream.getReader();
    let streamOutput = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = typeof value === 'string' ? value : new TextDecoder().decode(value);
      streamOutput += text;
      process.stdout.write(text);
    }
    console.log("\nStream complete!");

    console.log("\nTesting resolve...");
    const structuredOutput = await resolve({
      messages: [
        {
          role: "user",
          content: "Analyze this text: Langfuse is an open source LLM engineering platform to observe, evaluate and debug LLM applications. It makes it easy to analyze prompt executions, scores from user feedback, model response time, as well as custom scores.",
        },
      ],
      system: "You are a helpful AI assistant that provides structured analysis.",
      schema: testSchema,
    });
    console.log("Structured output:", structuredOutput);

    console.log("\nAll tests completed! Check Langfuse dashboard for traces.");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTests(); 