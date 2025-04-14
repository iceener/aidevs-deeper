import type { CoreMessage } from "ai";

// Define a standard handler signature
export type AgentToolHandler = (
  messages: CoreMessage[],
  threadId: number,
  controller: ReadableStreamDefaultController<string>
) => Promise<string>;

// Define the tool structure
export interface AgentTool {
  name: string;
  handler: AgentToolHandler;
}
