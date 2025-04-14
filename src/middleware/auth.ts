import type{ Context, Next } from "hono";
import { createAuthError } from "../errors";

const expectedApiKey = process.env.API_SECRET_KEY;

export const apiKeyAuth = async (c: Context, next: Next) => {
    if (!expectedApiKey) {
        console.error("FATAL: API_SECRET_KEY environment variable is not set.");
        throw new Error("Server configuration error: Missing API secret.");
    }

    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw createAuthError("Authorization header missing or invalid format. Expected 'Bearer <key>'.", 401);
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw createAuthError("Authorization header format is invalid. Expected 'Bearer <key>'.", 401);
    }
    const providedKey = parts[1];

    if (providedKey !== expectedApiKey) {
        throw createAuthError("Invalid API key provided.", 401);
    }

    await next();
}; 