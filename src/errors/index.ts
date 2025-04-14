export interface AppError extends Error {
	type: string; 
	statusCode: number;
	cause?: unknown; 
}

export function isAppError(error: unknown): error is AppError {
	return (
		typeof error === 'object' &&
		error !== null &&
		'type' in error &&
		typeof (error as any).type === 'string' &&
		'statusCode' in error &&
		typeof (error as any).statusCode === 'number' &&
		'message' in error &&
		typeof (error as any).message === 'string' &&
		error instanceof Error 
	);
}

// --- Factory Functions ---

const createError = (
	type: string,
	message: string,
	statusCode: number,
	cause?: unknown,
): AppError => {
	const error = new Error(message) as AppError;
	error.name = type; 
	error.type = type;
	error.statusCode = statusCode;

	if (cause) {
		error.cause = cause;
		if (cause instanceof Error && cause.message) {
			error.message = `${message} (Caused by: ${cause.message})`;
		}
	}

	if (Error.captureStackTrace) {
		Error.captureStackTrace(error, createError); 
	}


	return error;
};


export const createValidationError = (message: string = "Invalid input", cause?: unknown): AppError => {
	return createError("ValidationError", message, 400, cause);
};

export const createNotFoundError = (resource: string = "Resource", identifier?: string, cause?: unknown): AppError => {
	const message = identifier
		? `${resource} with identifier '${identifier}' not found.`
		: `${resource} not found.`;
	return createError("NotFoundError", message, 404, cause);
};

export const createFileSystemError = (message: string = "File system operation failed", cause?: unknown): AppError => {
	return createError("FileSystemError", message, 500, cause);
};

export const createDatabaseError = (message: string = "Database operation failed", cause?: unknown): AppError => {
	return createError("DatabaseError", message, 500, cause);
};

export const createAuthError = (message: string = "Authentication failed", statusCode: 401 | 403 = 401, cause?: unknown): AppError => {
	const type = statusCode === 401 ? "UnauthorizedError" : "ForbiddenError";
	return createError(type, message, statusCode, cause);
};

export const createConflictError = (message: string = "Operation conflicts with existing resource", cause?: unknown): AppError => {
	return createError("ConflictError", message, 409, cause);
};
