// Import error definitions and the type guard from the errors directory
import {
	createDatabaseError,
	createFileSystemError,
	createNotFoundError,
	isAppError,
} from "../errors"; // Relative path from utils/ to errors/

export async function tryDb<T>(
	operation: () => Promise<T>,
	errorMessagePrefix: string,
): Promise<T> {
	try {
		return await operation();
	} catch (dbError) {
		// If the DB layer already threw a structured AppError, rethrow it directly.
		if (isAppError(dbError)) {
			throw dbError;
		}
		console.error(`[tryDb] Original error for "${errorMessagePrefix}":`, dbError);
		throw createDatabaseError(`${errorMessagePrefix}`, dbError);
	}
}

type HandleNotFoundOption = "returnNull" | "throwNotFound" | "propagate";

export async function tryFs<T>(
	operation: () => Promise<T>,
	errorMessagePrefix: string,
	options: { handleNotFound?: HandleNotFoundOption } = {},
): Promise<T | null> {
	// Default to propagating ENOENT upwards as a wrapped FileSystemError unless specified otherwise
	const { handleNotFound = "propagate" } = options;

	try {
		return await operation();
	} catch (fsError: any) {
		// Handle File Not Found based on options
		if (fsError.code === "ENOENT") {
			if (handleNotFound === "returnNull") {
				console.warn(`[tryFs] File not found (ENOENT), returning null for: ${errorMessagePrefix}`);
				return null;
			}
			if (handleNotFound === "throwNotFound") {
				// Wrap ENOENT as a specific NotFoundError
				throw createNotFoundError("File", undefined, fsError); // Consider adding identifier if available
			}
			// Default ('propagate'): Fall through to wrap ENOENT as a FileSystemError below
		}

		// If it's already one of our specific AppErrors (e.g., from sanitizePath called within the operation), rethrow it.
		if (isAppError(fsError)) {
			throw fsError;
		}

		// Otherwise, wrap it as a FileSystemError.
		// Log the original error for detailed debugging before wrapping
		console.error(`[tryFs] Original error for "${errorMessagePrefix}":`, fsError);
		throw createFileSystemError(`${errorMessagePrefix}`, fsError);
	}
} 