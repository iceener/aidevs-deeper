import { db } from "@/db";
import { documents, tasks, results, tasks_to_documents } from "@/db/schema";
import { eq, sql, inArray, or, isNotNull, and } from "drizzle-orm";
import { readDocument, saveDocument } from "../core/fs.service";
import type { Task } from "../agent/tasks.service";
import type { CoreMessage } from "@/types/ai";
import { generateWebSearchQueries, scrape, search, selectWebResults } from "../core/web.service";

// Infer types from schema
export interface AugmentedDocument extends Document {
    content: string | undefined;
}
export type Document = typeof documents.$inferSelect;
// Note: NewDocument type might need adjustment if used elsewhere, as 'id' is now auto-generated
// type NewDocument = typeof documents.$inferInsert;

export const listDocuments = async (): Promise<Document[]> => {
    const records = await db.query.documents.findMany();
    return records;
}   

// Renamed: Fetches by UUID
export const getDocumentRecordByUuid = async (
	uuid: string, // Changed parameter name from id to uuid
): Promise<Document | undefined> => {
	try {
		const record = await db.query.documents.findFirst({
			where: eq(documents.uuid, uuid), // Use the 'uuid' column for lookup
			// Explicit columns might not be needed if 'findFirst' returns all by default,
			// but keeping it ensures we get what we expect.
			columns: {
				id: true, // Include the new PK
				uuid: true,
				path: true,
				url: true,
				name: true,
				type: true,
				source_id: true,
				description: true,
				createdAt: true,
				updatedAt: true,
			}
		});
		return record;
	} catch (error) {
		console.error("Error fetching document record by UUID:", error);
		throw new Error("Failed to fetch document record from database.");
	}
};

// Get multiple documents by UUIDs in parallel
export const getDocumentRecordsByUuids = async (
    uuids: string[]
): Promise<Array<Document & { content?: string }>> => {
    try {
        if (!uuids.length) return [];
        
        // Fetch all documents in a single query
        const records = await db.query.documents.findMany({
            where: inArray(documents.uuid, uuids),
            columns: {
                id: true,
                uuid: true,
                type: true,
                name: true,
                description: true,
                path: true,
                url: true,
                createdAt: true,
                updatedAt: true,
                source_id: true,
            }
        });
        
        // Format documents with their content
        // Using Promise.all to process all documents in parallel
        const formattedDocuments = await Promise.all(
            records.map(async (doc) => {
                try {
                    // Here you would typically read the content from the file path
                    // This is a placeholder for actual file reading logic
                    const content = `Content for document ${doc.name} from ${doc.path}`;
                    
                    return {
                        ...doc,
                        content
                    };
                } catch (error) {
                    console.error(`Error loading content for document ${doc.uuid}:`, error);
                    return {
                        ...doc,
                        content: undefined
                    };
                }
            })
        );
        
        return formattedDocuments;
    } catch (error) {
        console.error("Error fetching multiple document records by UUIDs:", error);
        throw new Error("Failed to fetch multiple document records from database.");
    }
};

// Function to get document UUID-ID pairs by UUIDs
export const getDocumentIdPairsByUuids = async (
    uuids: string[]
): Promise<{ uuid: string; id: number }[]> => {
    if (!uuids || uuids.length === 0) {
        console.warn("getDocumentIdPairsByUuids called with empty or invalid UUID list.");
        return []; 
    }
    
    try {
        const result = await db
            .select({ id: documents.id, uuid: documents.uuid }) // Select both id and uuid
            .from(documents)
            .where(inArray(documents.uuid, uuids)); // Filter by UUIDs in the list
            
        // Result is already in the desired format { id: number, uuid: string }[]
        return result; 
    } catch (error) {
        console.error("Error fetching document ID pairs by UUIDs:", error);
        // Depending on requirements, you might re-throw or return empty
        throw new Error("Failed to fetch document ID pairs from database."); 
    }
};

// Renamed: Operates on UUID, inserts uuid, path, name, and type
export const createDocumentRecord = async (
	uuid: string, 
	filePath: string, // Map to 'path'
	originalFilename: string, // Map to 'name'
    type: Document['type'] // Added required type parameter
): Promise<Document | undefined> => {
	try {
		// 'id' (PK) is auto-incremented by SQLite, no need to provide it
		const [newRecord] = await db
			.insert(documents)
			.values({ uuid, path: filePath, name: originalFilename, type }) // Added type
			// createdAt and updatedAt have defaults defined in the schema
			.returning(); // Drizzle returns the full record including the generated id and timestamps
		return newRecord;
	} catch (error) {
		console.error("Error creating document record:", error);
		throw new Error("Failed to create document record in database.");
	}
};

// Example: Function to update document record (if needed later)
// This would need to manually set the updatedAt field.
export const updateDocumentRecordDetails = async (
    uuid: string,
    updates: Partial<Pick<Document, 'name' | 'description' | 'path' | 'url' /* other updatable fields */>>
): Promise<Document | undefined> => {
    try {
        const [updatedRecord] = await db.update(documents)
            .set(updates)
            .where(eq(documents.uuid, uuid))
            .returning();
        return updatedRecord;
    } catch (error) {
        console.error("Error updating document record:", error);
        throw new Error("Failed to update document record in database.");
    }
};

// Get documents by source IDs
export const getDocumentsBySourceIds = async (sourceIds: number[]): Promise<Document[]> => {
    try {
        if (!sourceIds.length) return [];
        
        // Fetch all documents for the given source IDs
        const records = await db
            .select()
            .from(documents)
            .where(inArray(documents.source_id, sourceIds));
            
        return records;
    } catch (error) {
        console.error(`Error fetching documents for source IDs ${sourceIds.join(', ')}:`, error);
        throw new Error(`Failed to fetch documents for source IDs.`);
    }
};

// Function to get document ID by UUID
export const getDocumentIdByUuid = async (
    uuid: string
): Promise<number | undefined> => {
    try {
        if (!uuid) {
            console.warn("getDocumentIdByUuid called with empty UUID");
            return undefined;
        }
        
        const result = await db
            .select({ id: documents.id })
            .from(documents)
            .where(eq(documents.uuid, uuid))
            .limit(1);
            
        return result.length > 0 ? result[0].id : undefined;
    } catch (error) {
        console.error(`Error fetching document ID for UUID ${uuid}:`, error);
        throw new Error("Failed to fetch document ID from database");
    }
};

// Get documents by UUIDs
export const getDocumentsByUuids = async (
    uuids: string[]
): Promise<Document[]> => {
    try {
        if (!uuids.length) return [];
        
        const records = await db
            .select()
            .from(documents)
            .where(inArray(documents.uuid, uuids));
            
        return records;
    } catch (error) {
        console.error("Error fetching documents by UUIDs:", error);
        throw new Error("Failed to fetch documents by UUIDs.");
    }
};

// Get documents by IDs
export const getDocumentsById = async (
    ids: number[]
): Promise<Document[]> => {
    try {
        if (!ids.length) return [];
        
        const records = await db
            .select()
            .from(documents)
            .where(inArray(documents.id, ids));
            
        return records;
    } catch (error) {
        console.error("Error fetching documents by IDs:", error);
        throw new Error("Failed to fetch documents by IDs.");
    }
};

// Function to augment local documents with their content
export const augmentLocalDocumentsWithContent = async (
    docs: Document[]
): Promise<AugmentedDocument[]> => {
    const localDocs = docs.filter(doc => doc.type === 'local');
    
    const augmentedDocsPromises = localDocs.map(async (doc): Promise<AugmentedDocument> => {
        if (!doc.uuid) {
            console.warn(`Document ID ${doc.id} is missing UUID. Skipping content loading.`);
            return { ...doc, content: undefined };
        }
        try {
            const fileData = await readDocument(doc.uuid);
            if (fileData) {
                return { ...doc, content: fileData.content };
            } else {
                console.warn(`Could not read content for local document ${doc.uuid} (ID: ${doc.id}).`);
                return { ...doc, content: undefined };
            }
        } catch (error) {
            console.error(`Error loading content for document ${doc.uuid} (ID: ${doc.id}):`, error);
            return { ...doc, content: undefined }; // Return document without content on error
        }
    });

    return Promise.all(augmentedDocsPromises);
};

export const augmentExternalDocumentsWithContent = async (
    docs: Document[],
    task: Task,
): Promise<AugmentedDocument[]> => {
    if (!task.context) {
        return docs.map(doc => ({
            ...doc,
            content: `Content of this document couldn't be loaded because the task wasn't described well enough.`
        }));
    }
    if (docs.length === 0) {
        return [];
    }

    // --- Generate search queries once ---
    // Using the first doc only for context example in the prompt
    const contextForQueryGeneration = `Task: ${task.name}\nDescription: ${task.description}\n\nRephrased user request: ${task.context}.\n    The system will search information within specific sites relevant to this task (e.g., ${docs[0].name} at ${docs[0].url}). Generate queries focused on the user request.`;

    let searchQueries: string[];
    try {
        // Assuming generateWebSearchQueries returns Promise<string[]>
        searchQueries = await generateWebSearchQueries(contextForQueryGeneration, 3);
        if (!searchQueries || searchQueries.length === 0) {
            console.warn("No search queries generated.");
            // Return a neutral message if no queries could be formed
            return docs.map(doc => ({ ...doc, content: "Could not generate search queries for augmentation." }));
        }
    } catch (queryGenError) {
        console.error("Failed to generate search queries:", queryGenError);
        // Return specific error if query generation fails critically
        return docs.map(doc => ({
            ...doc,
            content: `Failed to generate search queries: ${queryGenError instanceof Error ? queryGenError.message : 'Unknown error'}`
        }));
    }

    // --- Process documents concurrently, direct style inside map ---
    const augmentedDocsPromises = docs.map(async (doc): Promise<AugmentedDocument> => {
        if (!doc.url) {
            // Handle missing URL simply
            return { ...doc, content: "Document is missing a URL." };
        }

        // Direct sequence for this doc, using the first generated query
        // Errors here will cause the individual promise to reject
        const siteQuery = `site:${doc.url} ${searchQueries[0]}`;
        const searchResults = await search({ query: siteQuery });

        // Simple check for results
        if (!searchResults || searchResults.length === 0) {
             return { ...doc, content: `No relevant content found on ${doc.url}.` };
        }

        const selectedPages = await selectWebResults(searchResults);

        // Simple check for selected page URL
        if (!selectedPages || selectedPages.length === 0 || !selectedPages[0]?.url) {
            return { ...doc, content: `Could not identify a specific page on ${doc.url} to scrape.` };
        }

        const targetUrl = selectedPages[0].url;
        const pageContent = await scrape({ url: targetUrl });

        // Return augmented document
        return {
            ...doc,
            content: pageContent?.markdown
                ? `Dynamically retrieved content from ${targetUrl}:\n\n${pageContent.markdown}`
                : `Scraped content from ${targetUrl} was empty or invalid.`
        };
    });

    // --- Wait for all promises ---
    // Use Promise.allSettled to get results even if some promises fail
    const results = await Promise.allSettled(augmentedDocsPromises);

    // Map settled results back to AugmentedDocument array
    return results.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value; // This is the successfully augmented document
        } else {
            // Handle rejected promise (error during search/scrape for this doc)
            console.error(`Failed to augment document ${docs[index].uuid || docs[index].id} (${docs[index].url}):`, result.reason);
            return {
                ...docs[index], // Return original document data
                content: `Error retrieving content from ${docs[index].url}: ${result.reason instanceof Error ? result.reason.message : 'Processing failed'}`
            };
        }
    });
}

// Convenience function that allows using different columns
export const getDocumentsBy = async (
    columnName: 'uuid' | 'id',
    values: string[] | number[]
): Promise<Document[]> => {
    if (columnName === 'uuid') {
        return getDocumentsByUuids(values as string[]);
    } else if (columnName === 'id') {
        return getDocumentsById(values as number[]);
    }
    throw new Error(`Unsupported column: ${columnName}`);
};

// Function to get documents related to a specific thread
export const getDocumentsByThreadId = async (
    threadId: number,
): Promise<Document[]> => {
    try {
        // 1. Find tasks associated with the thread
        const relatedTasks = await db
            .select({ id: tasks.id }) // Only need task IDs
            .from(tasks)
            .where(eq(tasks.thread_id, threadId));

        if (relatedTasks.length === 0) {
            return []; // No tasks, therefore no related documents
        }

        const taskIds = relatedTasks.map(t => t.id);

        // 2. Find document IDs from the 'results' table (task output documents)
        const resultDocumentIdsQuery = db
            .selectDistinct({ documentId: results.document_id }) // Get distinct document IDs
            .from(results)
            .where(inArray(results.task_id, taskIds));

        // 3. Find document IDs from the 'tasks_to_documents' table (referenced documents)
        const referencedDocumentIdsQuery = db
            .selectDistinct({ documentId: tasks_to_documents.document_id }) // Get distinct document IDs
            .from(tasks_to_documents)
            .where(inArray(tasks_to_documents.task_id, taskIds));

        // Execute queries in parallel
        const [resultDocIds, referencedDocIds] = await Promise.all([
            resultDocumentIdsQuery,
            referencedDocumentIdsQuery
        ]);

        // 4. Combine and deduplicate document IDs
        const allDocumentIds = [
            ...resultDocIds.map(r => r.documentId),
            ...referencedDocIds.map(r => r.documentId)
        ];
        const uniqueDocumentIds = [...new Set(allDocumentIds)];

        if (uniqueDocumentIds.length === 0) {
            return []; // No related documents found
        }

        // 5. Fetch the actual document records using the combined unique IDs
        const relatedDocuments = await db
            .select()
            .from(documents)
            .where(inArray(documents.id, uniqueDocumentIds));

        return relatedDocuments;

    } catch (error) {
        console.error(`Error fetching documents for thread ID ${threadId}:`, error);
        throw new Error(`Failed to fetch documents for thread ID ${threadId}.`);
    }
};

// Function to create a 'generated' document
export const createGeneratedDocument = async (
    markdownContent: string,
    taskId: number // Optional: use task ID for filename or context
): Promise<Document | undefined> => {
    // Generate a filename, e.g., using the task ID and a timestamp
    const filename = `task_${taskId}_result_${Date.now()}.md`;

    try {
        // Call the core saveDocument function with type 'generated'
        const savedDocInfo = await saveDocument(markdownContent, filename, 'generated');

        // saveDocument now returns { id, uuid, path, name }, retrieve the full record
        const newRecord = await getDocumentRecordByUuid(savedDocInfo.uuid);

        return newRecord;
    } catch (error) {
        console.error(`Error creating generated document for task ${taskId}:`, error);
        // Re-throw or handle error as appropriate
        // If saveDocument or getDocumentRecordByUuid throws an AppError, it will propagate
        // Otherwise, wrap it if necessary (though tryDb/tryFs should handle this)
        throw error; 
    }
};