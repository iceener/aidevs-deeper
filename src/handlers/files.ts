import { type Context } from "hono";
import { getDocumentRecordByUuid } from "@/services/database/documents.service";
import { promises as fs } from "node:fs";
import path from "node:path";
import { saveDocument } from "@/services/core/fs.service";

const DOCUMENTS_ROOT = path.resolve(process.cwd(), "documents");

const sanitizePathForServing = (relativePath: string): string => {
	const resolved = path.resolve(DOCUMENTS_ROOT, relativePath);
	if (!resolved.startsWith(DOCUMENTS_ROOT + path.sep)) {
		throw new Error("Invalid path: Directory traversal attempt detected.");
	}
	// Path sanitization
	if (!/^[a-zA-Z0-9\-\.\/\\_]+$/.test(relativePath)) {
		throw new Error("Invalid characters in path.");
	}
	return resolved;
};

export const serveDocument = async (c: Context) => {
	const documentUuid = c.req.param("id");

	if (!documentUuid) {
		return c.json({ error: "Document UUID is required" }, 400);
	}

	try {
		const record = await getDocumentRecordByUuid(documentUuid);

		if (!record?.path) {
			return c.json({ error: "Document not found" }, 404);
		}

		const fullPath = sanitizePathForServing(record.path);

		try {
			await fs.access(fullPath, fs.constants.R_OK);
		} catch (accessError) {
			console.error(
				`[serveDocument] Error: File not accessible for UUID ${documentUuid} at path ${fullPath}:`,
				accessError,
			);
			// Security: Don't reveal specific file system errors if possible
			return c.json({ error: "Document file not found or inaccessible" }, 404);
		}

		const content = await fs.readFile(fullPath, "utf8");

		c.header("Content-Type", "text/markdown; charset=utf-8");
		if (record.name) {
			c.header(
				"Content-Disposition",
				`inline; filename="${record.name}"`,
			);
		}
		return c.body(content);
	} catch (error: any) {
		if (error.message.includes("Invalid path")) {
			console.error(
				`[serveDocument] Invalid path detected for UUID ${documentUuid}: ${error.message}`,
			);
			return c.json({ error: "Invalid request" }, 400);
		}
		console.error(`[serveDocument] Internal server error for UUID ${documentUuid}:`, error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

// --- UNIFIED Handler for POST /documents ---
export const createDocument = async (c: Context) => {
	const logPrefix = "[createDocument]";
	const contentType = c.req.header("Content-Type")?.toLowerCase() || "";

	let filename: string | undefined;
	let content: string | undefined;

	try {
		// --- Handle JSON Upload ---
		if (contentType.startsWith("application/json")) {
			const body = await c.req.json();
			filename = body?.filename;
			content = body?.content;

			if (typeof filename !== "string") {
				console.warn(`${logPrefix} Bad Request (JSON): Missing or invalid 'filename'.`);
				return c.json({ error: "Missing or invalid 'filename' field in JSON payload." }, 400);
			}
			if (typeof content !== "string") {
				console.warn(`${logPrefix} Bad Request (JSON): Missing or invalid 'content'.`);
				return c.json({ error: "Missing or invalid 'content' field in JSON payload." }, 400);
			}
		}
		// --- Handle Form Data Upload ---
		else if (contentType.startsWith("multipart/form-data")) {
			const formData = await c.req.formData();
			// Assume the file input field is named 'document'
			const file = formData.get("document");

			if (!file || !(file instanceof File)) {
				console.warn(`${logPrefix} Bad Request (Form): 'document' field missing or not a file.`);
				return c.json({ error: "Missing 'document' file field in form data." }, 400);
			}

			filename = file.name;
			content = await file.text(); // Read file content

			if (!filename) {
                 // Should generally not happen if it's a File object, but good to check.
                 console.warn(`${logPrefix} Bad Request (Form): File is missing a name.`);
                 return c.json({ error: "Uploaded file is missing a name." }, 400);
            }

		}
		// --- Handle Unsupported Type ---
		else {
			console.warn(`${logPrefix} Unsupported Media Type: ${contentType}`);
			return c.json(
				{ error: "Unsupported Content-Type. Use application/json or multipart/form-data." },
				415, // Unsupported Media Type
			);
		}

		// --- Common Validation (after extraction) ---
        filename = filename?.trim(); // Trim whitespace
        content = content?.trim(); // Trim whitespace

		if (!filename) {
			// This check covers cases where filename might be empty after trimming
			console.warn(`${logPrefix} Bad Request: Filename is empty.`);
			return c.json({ error: "Filename cannot be empty." }, 400);
		}

		// Strict filename validation
		const validFilenameRegex = /^[a-zA-Z0-9_.-]+$/;
		if (filename.includes("/") || filename.includes("\\") || !validFilenameRegex.test(filename)) {
			console.warn(`${logPrefix} Bad Request: Invalid characters or path separators in filename: ${filename}`);
			return c.json(
				{ error: "Invalid filename. Use only letters, numbers, underscores, hyphens, periods, and no slashes." },
				400,
			);
		}

		if (!content) {
            // Check after trimming
			console.warn(`${logPrefix} Bad Request: Content is empty.`);
			return c.json({ error: "Content cannot be empty." }, 400);
		}

		// --- Call Service Layer ---
		const savedDocInfo = await saveDocument(content, filename, "local");

		// Fetch the full record to include timestamps (which might differ slightly due to defaults)
		const fullRecord = await getDocumentRecordByUuid(savedDocInfo.uuid);
		if (!fullRecord) {
             console.error(`${logPrefix} Inconsistency: Document saved (UUID: ${savedDocInfo.uuid}) but record not found immediately after.`);
            return c.json({
                message: "Document created successfully (record retrieval issue)",
                document: savedDocInfo // Return basic info
            }, 201);
        }

		return c.json(
			{
				message: "Document created successfully",
				document: fullRecord, // Contains id, uuid, path, name, and timestamps
			},
			201,
		);

	} catch (error: any) {
		// Handle specific errors from parsing if possible
        if (error instanceof SyntaxError && contentType.startsWith("application/json")) {
            console.warn(`${logPrefix} Bad Request: Invalid JSON received.`, error);
			return c.json({ error: "Invalid JSON payload." }, 400);
        }
        // Hono might throw specific errors for form data parsing, check its docs if needed

        // Handle errors from saveDocument
		console.error(`${logPrefix} Error during document creation for ${filename ?? 'unknown'}:`, error);
		// Could check error.message or instanceof if saveDocument throws specific errors
		return c.json({ error: "Internal server error while creating document." }, 500);
	}
}; 