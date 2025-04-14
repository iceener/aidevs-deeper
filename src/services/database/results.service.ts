import { db } from "@/db";
import { results } from "@/db/schema";
import { tryDb } from "@/utils/errorHandling";
import { createDatabaseError } from "@/errors";

// Infer type for a new result entry
export type NewResult = typeof results.$inferInsert;
// Infer type for a selected result entry
export type Result = typeof results.$inferSelect;

/**
 * Creates a new entry in the results table to link a task to its output document.
 * @param taskId - The ID of the task that generated the result.
 * @param documentId - The ID of the document containing the result.
 * @returns The newly created result record.
 * @throws {DatabaseError} If the database operation fails.
 */
export const createResultEntry = async (
    taskId: number,
    documentId: number
): Promise<Result> => {
    const newEntry: NewResult = {
        task_id: taskId,
        document_id: documentId,
        // uuid, createdAt, updatedAt will be handled by defaults/db triggers
    };

    const record = await tryDb(
        () => db.insert(results).values(newEntry).returning(),
        `Create result entry linking task ${taskId} to document ${documentId}`
    );

    // tryDb should throw on error, but check defensively
    if (!record || record.length === 0) {
        throw createDatabaseError(`Failed to create result entry linking task ${taskId} to document ${documentId} (no record returned).`);
    }

    return record[0];
}; 