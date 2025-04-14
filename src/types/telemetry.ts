import { Langfuse } from "langfuse";

/**
 * Represents a context object for telemetry tracking
 * This is used to explicitly pass trace and span information throughout the call stack
 */
export interface TelemetryContext {
  /**
   * The main Langfuse trace for the current operation
   */
  trace: ReturnType<Langfuse['trace']>;
  
  /**
   * Optional current active span within the trace
   * This is used for finer-grained grouping within tools/loops
   */
  currentSpan?: ReturnType<ReturnType<Langfuse['trace']>['span']>;
  
  /**
   * Optional user ID for associating traces with users
   */
  userId?: string;
  
  /**
   * Optional session ID, typically mapping to a conversation or thread ID
   */
  sessionId?: string;

  /**
   * Optional additional metadata to associate with spans and traces
   */
  metadata?: Record<string, any>;
} 