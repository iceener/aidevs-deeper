import type { CoreMessage } from 'ai';
import { z } from 'zod';
import type { TelemetryContext } from './telemetry';

/**
 * AI related types
 */
export interface CompletionParams {
  messages: CoreMessage[];
  system?: string;
  model?: string;
  telemetry?: TelemetryContext;
  generationName?: string;
}

export interface ResolveParams<T extends z.ZodTypeAny> {
  messages: CoreMessage[];
  system: string;
  schema: T;
  model?: string;
  telemetry?: TelemetryContext;
  generationName?: string;
}

export interface TextContent {
  type: 'text';
  text: string;
}

export type ChatContent = TextContent[];

export interface ChatRequestBody {
  conversation_id?: string;
  messages: CoreMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export type { CoreMessage }; 