import { db } from "../../db"; // Assuming db connection setup is here
import { notes } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSourceIdByUuid } from "@/services/agent/sources.service"; 
import { getDocumentIdByUuid } from "../database/documents.service";

export type NewNote = typeof notes.$inferInsert;
export type Note = typeof notes.$inferSelect;

export const createNote = async (data: NewNote): Promise<Note | undefined> => {
  const [newNote] = await db.insert(notes).values(data).returning();
  return newNote;
}

export const getNoteById = async (id: number): Promise<Note | undefined> => {
  const [note] = await db.select().from(notes).where(eq(notes.id, id));
  return note;
}

export const listNotesByTask = async (taskId: number): Promise<Note[]> => {
  return db.select().from(notes).where(eq(notes.task_id, taskId));
}

export const listNotesByDocument = async (documentId: number): Promise<Note[]> => {
   return db.select().from(notes).where(eq(notes.document_id, documentId));
}

export const getNotesByUuids = async (documentUuids: string[]): Promise<Note[]> => {
  // Filter out any undefined/null values
  const validUuids = documentUuids.filter(Boolean);
  
  if (validUuids.length === 0) {
    return [];
  }
  
  // Convert UUIDs to document IDs
  const documentIdsPromises = validUuids.map(uuid => getDocumentIdByUuid(uuid));
  const documentIds = (await Promise.all(documentIdsPromises)).filter(Boolean) as number[];
  
  if (documentIds.length === 0) {
    return [];
  }
  
  // Query notes with these document IDs
  return db.select().from(notes).where(inArray(notes.document_id, documentIds));
}

export const saveQueriesAsNotes = async (queries: { source: string; query: string, document_uuid?: string }[], taskId: number) : Promise<Array<Note | null>> => {
    const noteCreationPromises = queries.map(async (q) => {
        const sourceId = await getSourceIdByUuid(q.source);
        const documentId = q.document_uuid ? await getDocumentIdByUuid(q.document_uuid) : null;
        if (!sourceId) {
            console.warn(`Could not find source ID for UUID: ${q.source}. Skipping note creation.`);
            return null; 
        }
        try {
            return createNote({
                task_id: taskId,
                source_id: sourceId,
                query: q.query,
                content: "",
                document_id: documentId,
            });
        } catch (error) {
            console.error(`Failed to create note for query '${q.query}' on source UUID ${q.source}:`, error);
            return null; 
        }
    });
    
    const createdNotes = (await Promise.all(noteCreationPromises)).filter(note => note !== null) as Note[];
    const validNotes = createdNotes.filter((note): note is Note => note !== null);
    console.log(`Created ${validNotes.length} initial notes for task ${taskId}.`);
    return validNotes; 
};

/**
 * Creates multiple notes in the database in a single transaction.
 * @param data An array of note objects to create. Each object should conform to the NewNote type.
 * @returns A promise that resolves with an array of the created notes, or an empty array if the input was empty or insertion failed.
 */
export const createMultipleNotes = async (data: NewNote[]): Promise<Note[]> => {
  if (!data || data.length === 0) {
    console.log("No notes provided to createMultipleNotes.");
    return [];
  }

  try {
    const newNotes = await db.insert(notes).values(data).returning();
    console.log(`Successfully inserted ${newNotes.length} notes.`);
    return newNotes;
  } catch (error) {
    console.error("Error creating multiple notes:", error);
    // Depending on requirements, you might want to handle partial success or specific errors.
    // For now, returning an empty array on failure.
    return [];
  }
};
