import type { Context } from "hono";
import { isAppError } from "../errors";

export const globalErrorHandler = (err: Error, c: Context) => {
    console.error("Unhandled error:", err); // Log the error for debugging

    if (isAppError(err)) {
        // If it's a recognized AppError, use its properties
        return c.json({ type: err.type, error: err.message }, err.statusCode);
    }
    // For generic errors or non-AppErrors, return a standard 500
    return c.json({ type: "InternalServerError", error: "An unexpected internal error occurred." }, 500);

    // Note: The check for non-Error types thrown is less critical here
    // as Hono typically ensures 'err' is an Error instance in onError.
}; 