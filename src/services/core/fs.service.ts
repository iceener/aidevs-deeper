import { promises as fs } from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import {
	createDocumentRecord,
	getDocumentRecordByUuid,
	updateDocumentRecordDetails,
	type Document,
} from "./../database/documents.service";
import {
	createFileSystemError,
	createDatabaseError,
	isAppError
} from "../../errors";
import { tryDb, tryFs } from "../../utils/errorHandling";

const DOCUMENTS_ROOT = path.resolve(process.cwd(), "documents");

tryFs(() => fs.mkdir(DOCUMENTS_ROOT, { recursive: true }), "Ensure root documents directory exists", { handleNotFound: 'propagate' })
	.catch((error: any) => {
		if (error?.code !== 'EEXIST') {
			console.error("[fs.service] Failed to create root documents directory on startup:", error);
		}
	});

const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
	await tryFs(
		() => fs.mkdir(dirPath, { recursive: true }),
		`Ensure directory exists: ${dirPath}`,
	).catch((error: any) => {
		if (error.code !== "EEXIST") {
			if (isAppError(error)) throw error;
			throw createFileSystemError(`Failed to create directory: ${dirPath}`, error);
		}
	});
};

const sanitizePath = (relativePath: string): string => {
	const resolvedPath = path.resolve(DOCUMENTS_ROOT, relativePath);
	if (!resolvedPath.startsWith(DOCUMENTS_ROOT + path.sep)) {
		const message = `Path traversal attempt detected: ${relativePath} resolved to ${resolvedPath}`;
			console.error(`[fs.service] ${message}`);
		throw createFileSystemError("Invalid path: Directory traversal attempt detected.");
	}
	const normalizedRelativePath = path.normalize(relativePath);
	if (normalizedRelativePath.includes('..')) {
		const message = `Path component '..' detected in normalized relative path: ${normalizedRelativePath}`;
		console.error(`[fs.service] ${message}`);
		throw createFileSystemError("Invalid path components.");
	}
	const segments = normalizedRelativePath.split(path.sep);
	const validSegmentRegex = /^[a-zA-Z0-9_.-]+$/;
	for (const segment of segments) {
		if (segment === '' || segment === '.') continue;
		if (!validSegmentRegex.test(segment)) {
			const message = `Invalid character detected in path segment: "${segment}" in path "${relativePath}"`;
			console.error(`[fs.service] ${message}`);
			throw createFileSystemError(`Invalid characters in path segment: ${segment}`);
		}
	}
	return resolvedPath;
};

const generateDocumentPaths = (
	uuid: string,
	originalFilename: string,
): { relativePath: string; relativeDir: string; fullPath: string; fullDirPath: string } => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const dateDir = `${year}-${month}-${day}`;

	// Directory structure: yyyy-mm-dd/document-uuid/
	const relativeDir = path.join(dateDir, uuid);
	// Sanitize original filename before joining (basename helps remove directory parts)
	const safeOriginalFilename = path.basename(originalFilename);
	// Full relative path including the original filename: yyyy-mm-dd/document-uuid/original_filename.ext
	const relativePath = path.join(relativeDir, safeOriginalFilename);
	// Construct absolute paths for file system operations
	const fullDirPath = path.resolve(DOCUMENTS_ROOT, relativeDir);
	const fullPath = path.resolve(DOCUMENTS_ROOT, relativePath);

	return { relativePath, relativeDir, fullPath, fullDirPath };
};

const _cleanupFailedSave = async (filePath: string, dirPath: string): Promise<void> => {
	try {
		await tryFs(() => fs.unlink(filePath), `Cleanup unlink: ${filePath}`, { handleNotFound: 'returnNull' });
		await tryFs(() => fs.rmdir(dirPath), `Cleanup rmdir: ${dirPath}`, { handleNotFound: 'returnNull' });
	} catch (cleanupError: any) {
		console.warn(
			`[fs.service] Unexpected error during cleanup after failed operation: ${filePath}`,
			cleanupError,
		);
	}
};

export const saveDocument = async (
	content: string,
	originalFilename: string,
	type: Document['type']
): Promise<{ id: number; uuid: string; path: string; name: string }> => {
	const generatedUuid = uuidv4();

	const { relativePath, fullDirPath } = generateDocumentPaths(
		generatedUuid,
		originalFilename,
	);

	let sanitizedFullPath: string | undefined;

	try {
		await ensureDirectoryExists(fullDirPath);
		sanitizedFullPath = sanitizePath(relativePath);

		await tryFs(
			() => fs.writeFile(sanitizedFullPath!, content, "utf8"),
			`Write file: ${sanitizedFullPath}`
		);
		console.log(`[fs.service] Saved file to: ${sanitizedFullPath}`);
		
		const record = await tryDb(
			() => createDocumentRecord(generatedUuid, relativePath, originalFilename, type),
			`Create DB record for UUID ${generatedUuid}`
		);

		if (!record) {
			console.warn(`[fs.service] DB record creation unexpectedly returned null for ${generatedUuid}. Attempting cleanup.`);
			await _cleanupFailedSave(sanitizedFullPath!, fullDirPath);
			throw createDatabaseError("Failed to save document metadata to database (null record).");
		}

		console.log(`[fs.service] Created DB record for UUID ${generatedUuid}, path: ${relativePath}`);
		return {
			id: record.id,
			uuid: record.uuid,
			path: record.path,
			name: record.name
		};
	} catch (error) {
		if (sanitizedFullPath) {
			console.warn(`[fs.service] Attempting cleanup for partially saved document ${generatedUuid}`);
			await _cleanupFailedSave(sanitizedFullPath, fullDirPath);
		}
		if (isAppError(error)) {
			throw error;
		} else {
			throw createFileSystemError(`Unexpected failure during save document`, error);
		}
	}
};

export const readDocument = async (
	uuid: string,
): Promise<{ content: string; filePath: string; originalFilename: string } | null> => {
	// Use tryDb to get the record
	const record = await tryDb(
		() => getDocumentRecordByUuid(uuid),
		`Retrieve document record for UUID: ${uuid}`
	);

	if (!record?.path) {
		console.warn(`[fs.service] Document record not found or incomplete for UUID: ${uuid}`);
		return null;
	}

	const fullPath = sanitizePath(record.path); 

	const content = await tryFs(
		() => fs.readFile(fullPath, "utf8"),
		`Read file for document UUID ${uuid}`,
		{ handleNotFound: 'returnNull' }
	);

	if (content === null) {
		console.warn(`[fs.service] File not found (ENOENT handled as null) for document UUID ${uuid} at path ${record.path}`);
		return null;
	}

	return { content, filePath: record.path, originalFilename: record.name };
};

export const updateDocument = async (
	uuid: string,
	newContent: string,
): Promise<{ id: number; uuid: string; filePath: string; originalFilename: string } | null> => {
	// Use tryDb to get the record
	const record = await tryDb(
		() => getDocumentRecordByUuid(uuid),
		`Retrieve document record for update: UUID ${uuid}`
	);

	if (!record?.path) {
		console.warn(`[fs.service] Document record not found or incomplete for update: UUID ${uuid}`);
		return null;
	}

	const fullPath = sanitizePath(record.path); // Throws directly

	// Use tryFs for writeFile, handle ENOENT by returning null
	const writeResult = await tryFs(
		() => fs.writeFile(fullPath, newContent, "utf8"),
		`Write updated file for UUID ${uuid}`,
		{ handleNotFound: 'returnNull' } // If file deleted between get and write
	);

	if (writeResult === null) {
		// Log handled ENOENT case
		console.warn(`[fs.service] File not found (ENOENT handled as null) during update for UUID ${uuid} at path ${record.path}`);
		return null;
	}

	// Use tryDb for timestamp update
	const updatedRecord = await tryDb(
		() => updateDocumentRecordDetails(uuid, {}),
		`Update document timestamp for UUID ${uuid}`
	);

	if (!updatedRecord) {
		// Should not happen if tryDb throws on failure, but handle defensively
		console.warn(`[fs.service] Failed to update timestamp (null record returned) for document UUID ${uuid} after file write.`);
		// Return old record details as a fallback
		return {
			id: record.id,
			uuid: record.uuid,
			filePath: record.path,
			originalFilename: record.name
		};
	}

	return {
		id: updatedRecord.id,
		uuid: updatedRecord.uuid,
		filePath: updatedRecord.path,
		originalFilename: updatedRecord.name
	};
};