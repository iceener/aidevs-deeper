import type { Context, Next } from "hono";
import { createValidationError } from "../errors";
import type { ChatRequestBody } from "../types/ai";

export const validateChatRequest = async (c: Context, next: Next) => {
  try {
    const body = await c.req.json().catch((err) => {
      throw createValidationError("Invalid JSON request body");
    });

    if (!body || typeof body !== 'object') {
      throw createValidationError("Invalid request body type");
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      throw createValidationError("Missing or empty 'messages' array");
    }

    c.set('chat', body as ChatRequestBody);
    
    await next();
  } catch (error) {
    throw error;
  }
}; 