import type { CompletionParams, ResolveParams } from "../../types/ai";
import type { TelemetryContext } from "../../types/telemetry";

import { z } from "zod";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText, streamText } from "ai";
import { config } from "@/config/ai";
import {
  createGeneration,
  logErrorGeneration,
  createTelemetryStream,
  startTraceContext,
} from "../core/telemetry.service";

export type StreamCompletionParams = CompletionParams & {
  generationName?: string;
};

export type ExtendedResolveParams<T extends z.ZodTypeAny> = ResolveParams<T> & {
  generationName?: string;
};

export const completion = async ({
  messages,
  system,
  model = config.model,
  telemetry,
  generationName,
}: CompletionParams & { generationName?: string }): Promise<string> => {
  const ctx = telemetry || startTraceContext({
    name: "AI Completion",
    metadata: {
      messageCount: messages.length,
      model,
    },
  });

  try {
    const generation = createGeneration({
      telemetry: ctx,
      name: generationName || "LLM Completion",
      model,
      messages,
      system,
    });

    const { text } = await generateText({
      model: openai.responses(model),
      system,
      messages,
      experimental_telemetry: { isEnabled: true },
    });

    // Log the completion
    generation.end({
      output: text,
    });

    return text;
  } catch (error) {
    // Log errors to Langfuse
    logErrorGeneration({
      telemetry: ctx,
      name: (generationName ? `${generationName}-error` : "LLM Completion Error"),
      model,
      messages,
      system,
      error,
    });

    throw error;
  }
};

export const streamCompletion = async ({
  messages,
  system,
  model = config.model,
  telemetry,
  generationName,
}: StreamCompletionParams): Promise<ReadableStream<string>> => {
  const ctx = telemetry || startTraceContext({
    name: "AI Stream Completion",
    metadata: {
      messageCount: messages.length,
      model,
    },
  });

  try {
    const generation = createGeneration({
      telemetry: ctx,
      name: generationName || "LLM Stream",
      model,
      messages,
      system,
    });

    const { textStream } = await streamText({
      model: openai.responses(model),
      system,
      messages,
      experimental_telemetry: { isEnabled: true },
    });

    const transformStream = createTelemetryStream(generation);

    return textStream.pipeThrough(transformStream);
  } catch (error) {
    logErrorGeneration({
      telemetry: ctx,
      name: (generationName ? `${generationName}-error` : "LLM Stream Error"),
      model,
      messages,
      system,
      error,
    });

    throw error;
  }
};

export const resolve = async <T extends z.ZodTypeAny>({
  messages,
  system,
  schema,
  model = config.model,
  telemetry,
  generationName,
}: ExtendedResolveParams<T>) => {
  const ctx = telemetry || startTraceContext({
    name: "AI Structured Output",
    metadata: {
      messageCount: messages.length,
      model,
      schemaType: schema ? schema.constructor.name : "unknown",
    },
  });

  try {
    const generation = createGeneration({
      telemetry: ctx,
      name: generationName || "LLM Structured Generation",
      model,
      messages,
      system,
      schema,
      maxTokens: 64000,
    });

    const currentModel =
      model === "gemini-2.5-pro-preview-03-25"
        ? google(model)
        : openai.responses(config.model);
    const obj = await generateObject({
      model: currentModel,
      schema,
      messages,
      system,
      maxTokens: 64000,
      experimental_telemetry: { isEnabled: true },
    });
    
    generation.end({
      output: obj.object,
    });

    return obj.object;
  } catch (error) {
    logErrorGeneration({
      telemetry: ctx,
      name: (generationName ? `${generationName}-error` : "LLM Structured Output Error"),
      model,
      messages,
      system,
      schema,
      error,
    });

    throw error;
  }
};
