import type { CoreMessage } from "ai";
import { Langfuse } from "langfuse";
import { z } from "zod";
import type { TelemetryContext } from "../../types/telemetry";

const langfuse = new Langfuse({
  baseUrl: process.env.LANGFUSE_BASEURL,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
});

export const startTraceContext = ({
  name,
  userId,
  threadId, // threadid === sessionid
  sessionId,
  messageId,
  metadata = {},
}: {
  name: string;
  userId?: string;
  threadId?: number | string; 
  sessionId?: string;
  messageId?: number | string;
  metadata?: Record<string, any>;
}): TelemetryContext => {
  const effectiveSessionId = sessionId || (typeof threadId === 'string' ? threadId : String(threadId));

  const trace = langfuse.trace({
    name,
    userId,
    sessionId: effectiveSessionId,
    metadata: {
      ...(threadId !== undefined ? { threadId: String(threadId) } : {}),
      ...(messageId !== undefined ? { messageId: String(messageId) } : {}),
      ...metadata,
    },
  });

  return {
    trace,
    userId,
    sessionId: effectiveSessionId,
    metadata,
  };
};

export const startSpan = (
  telemetry: TelemetryContext, 
  name: string, 
  metadata: Record<string, any> = {}
): TelemetryContext => {
  const span = telemetry.trace.span({
    name,
    metadata: {
      ...metadata,
      ...(telemetry.metadata || {}),
    },
  });

  return {
    ...telemetry,
    currentSpan: span,
  };
};

export const endSpan = (
  telemetry: TelemetryContext, 
  output?: Record<string, any> | string | null,
  error?: Error | unknown
): TelemetryContext => {
  if (telemetry.currentSpan) {
    if (error) {
      telemetry.currentSpan.end({
        output: output || String(error),
        level: "ERROR",
        statusMessage: String(error),
      });
    } else if (output) {
      telemetry.currentSpan.end({
        output: typeof output === 'string' ? output : output,
      });
    } else {
      telemetry.currentSpan.end();
    }
  }

  return {
    ...telemetry,
    currentSpan: undefined,
  };
};

export const trackEvent = (
  telemetry: TelemetryContext, 
  name: string, 
  input?: Record<string, any> | null,
  output?: Record<string, any> | null,
  metadata?: Record<string, any>
): void => {
  (telemetry.currentSpan || telemetry.trace).event({
    name,
    input,
    output,
    metadata: {
      ...(metadata || {}),
      ...(telemetry.metadata || {}),
    }
  });
};

export const createGeneration = ({
  telemetry,
  name,
  model,
  messages,
  system,
  schema,
  temperature = 0.7,
  maxTokens,
}: {
  telemetry: TelemetryContext;
  name: string;
  model: string;
  messages: CoreMessage[];
  system?: string;
  schema?: z.ZodTypeAny;
  temperature?: number;
  maxTokens?: number;
}) => {
  const formattedMessages = system 
    ? [{ role: 'system', content: system } as CoreMessage, ...messages]
    : messages;

  return (telemetry.currentSpan || telemetry.trace).generation({
    name,
    model,
    modelParameters: {
      temperature,
      ...(maxTokens ? { maxTokens } : {}),
    },
    input: {
      messages: formattedMessages,
      ...(schema ? { schema: schema.constructor.name } : {}),
    },
  });
};

export const logErrorGeneration = ({
  telemetry,
  name,
  model,
  messages,
  system,
  schema,
  error,
}: {
  telemetry: TelemetryContext;
  name: string;
  model: string;
  messages: CoreMessage[];
  system?: string;
  schema?: z.ZodTypeAny;
  error: Error | unknown;
}) => {
  const formattedMessages = system 
    ? [{ role: 'system', content: system } as CoreMessage, ...messages]
    : messages;

  return (telemetry.currentSpan || telemetry.trace).generation({
    name,
    model,
    input: {
      messages: formattedMessages,
      ...(schema ? { schema: schema.constructor.name } : {}),
    },
    output: String(error),
    level: "ERROR",
    statusMessage: String(error),
  }).end();
};

export const createTelemetryStream = (generation: ReturnType<typeof createGeneration>) => {
  let fullOutput = "";
  
  return new TransformStream({
    transform: (chunk, controller) => {
      const text = chunk.toString();
      fullOutput += text;
      controller.enqueue(chunk);
    },
    flush: () => {
      generation.end({
        output: fullOutput,
      });
    }
  });
}; 