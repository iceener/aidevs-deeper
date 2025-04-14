import { db } from "../../db"; // Assuming db connection setup is here
import { tasks, notes, steps, results, documents, sources, tasks_to_documents, tasks_to_sources } from "../../db/schema"; // Import related table schemas, including documents, sources, and junction tables
import { eq, and } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm"; // Import InferSelectModel
import type { Note } from "./notes.service"; // Assuming Note type is exported from notes service
import type { Step } from "./steps.service"; // Assuming Step type is exported from steps service
import type { Document } from "../database/documents.service"; // Import Document type from its service
import type { Source } from "./sources.service"; // Import Source type from its service
import { getSourcesByUuids } from "./sources.service"; // Import function to get sources by UUIDs
import { getDocumentIdPairsByUuids } from "../database/documents.service"; // Import function to get doc UUID-ID pairs
// import type { Document } from "./documents.service"; // Assuming Document type is exported
// Define a basic Document type based on the schema for now
// type Document = InferSelectModel<typeof documents>;

// Define Input/Output types based on schema (adjust as needed)
type NewTask = typeof tasks.$inferInsert;
export type Task = typeof tasks.$inferSelect;
type TaskStatus = Task['status'];

// Define the Result type based on the schema
type Result = InferSelectModel<typeof results>;
type TaskToDocument = InferSelectModel<typeof tasks_to_documents>;
type TaskToSource = InferSelectModel<typeof tasks_to_sources>;

// Define the Result type with its related Document
type ResultWithDocument = Result & {
  document: Document; // Assuming Document type is correctly imported or defined
};

// Define the type for the junction table record with the nested document
type TaskToDocumentWithDocument = TaskToDocument & {
  document: Document;
};

// Define the type for the junction table record with the nested source
type TaskToSourceWithSource = TaskToSource & {
  source: Source;
};

// Define the extended Task type with relations, including nested documents in results
// and referenced documents/sources via junction tables
export type TaskWithRelations = Task & {
  notes: Note[];
  steps: Step[];
  results: ResultWithDocument[]; // Output documents
  tasksToDocuments: TaskToDocumentWithDocument[]; // Junction records linking to referenced documents
  tasksToSources: TaskToSourceWithSource[];     // Junction records linking to referenced sources
};

export const createTask = async (data: Omit<NewTask, 'status' | 'document_id'>): Promise<Task | undefined> => {
  // Ensure context is stringified if it's not already a string
  const contextString = typeof data.context === 'string' 
      ? data.context 
      : JSON.stringify(data.context); // Stringify if object/array

  const [newTask] = await db.insert(tasks).values({
      ...data,
      context: contextString, // Use the stringified context
      status: 'pending', // Default status
  }).returning();
  return newTask;
}

export const getTaskById = async (id: number): Promise<TaskWithRelations | undefined> => {
  // Use db.query with nested 'with' clauses to fetch all relations
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: {
      notes: true,   // Fetch related notes
      steps: true,   // Fetch related steps
      results: {     // Fetch related results...
        with: {
          document: true // ...and their associated document
        }
      },
      tasksToDocuments: { // Fetch through the junction table...
        with: {
          document: true // ...to get the referenced documents
        }
      },
      tasksToSources: {   // Fetch through the junction table...
        with: {
          source: true   // ...to get the referenced sources
        }
      }
    }
  });
  // Cast needed as Drizzle's inference on deeply nested relations might be incomplete
  return task as TaskWithRelations | undefined;
}

export const updateTaskStatus = async (id: number, status: TaskStatus): Promise<Task | undefined> => {
   const [updatedTask] = await db.update(tasks)
     .set({ status, updatedAt: new Date().toISOString() }) // Update status and timestamp
     .where(eq(tasks.id, id))
     .returning();
   return updatedTask;
}

export const updateTask = async (id: number, data: Partial<Task>): Promise<Task | undefined> => {
  const [updatedTask] = await db.update(tasks)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(tasks.id, id))
    .returning();
  return updatedTask;
}

// Commenting out this function as the 'tasks' table doesn't have a direct document_id.
// Task results are linked via the 'results' table.
// Consider refactoring to create a 'result' record instead.
/*
export const linkTaskToDocument = async (taskId: number, documentId: number): Promise<Task | undefined> => {
  const [updatedTask] = await db.update(tasks)
    .set({ document_id: documentId, updatedAt: new Date().toISOString() })
    .where(eq(tasks.id, taskId))
    .returning();
  return updatedTask;
}
*/

export const getTaskByThreadId = async (threadId: number): Promise<TaskWithRelations | undefined> => {
  // Use db.query with nested 'with' clauses similar to getTaskById
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.thread_id, threadId),
    with: {
      notes: true,   // Fetch related notes
      steps: true,   // Fetch related steps
      results: {     // Fetch related results...
        with: {
          document: true // ...and their associated document
        }
      },
      tasksToDocuments: { // Fetch through the junction table...
        with: {
          document: true // ...to get the referenced documents
        }
      },
      tasksToSources: {   // Fetch through the junction table...
        with: {
          source: true   // ...to get the referenced sources
        }
      }
    },
    // Optional: Add ordering if multiple tasks per thread are possible and you need the latest
    // orderBy: (tasks, { desc }) => [desc(tasks.createdAt)], 
  });
  // Cast needed as Drizzle's inference on deeply nested relations might be incomplete
  return task as TaskWithRelations | undefined;
}

export const listTasksByThread = async (threadId: number): Promise<Task[]> => {
  return db.select().from(tasks).where(eq(tasks.thread_id, threadId));
}

// NEW function to link a task to multiple sources using their UUIDs
export const linkTaskToSources = async (taskId: number, sourceUuids: string[]): Promise<void> => {
  if (!sourceUuids || sourceUuids.length === 0) {
    console.log(`No source UUIDs provided for task ${taskId}. Skipping link.`);
    return;
  }

  // 1. Fetch sources by their UUIDs to get their IDs
  const sources = await getSourcesByUuids(sourceUuids);
  const sourceIds = sources.map(s => s.id);

  if (sourceIds.length === 0) {
    console.log(`No valid sources found for the provided UUIDs for task ${taskId}. Skipping link.`);
    return;
  }
  
  if (sourceIds.length !== sourceUuids.length) {
    console.warn(`Task ${taskId}: Not all provided source UUIDs were found. Found ${sourceIds.length} out of ${sourceUuids.length}.`);
  }

  // 2. Prepare values for insertion using the fetched source IDs
  const valuesToInsert = sourceIds.map(sourceId => ({
    task_id: taskId,
    source_id: sourceId,
  }));

  // 3. Insert links into the junction table
  try {
    // Use insert with onConflictDoNothing to avoid errors if the link already exists
    await db.insert(tasks_to_sources)
      .values(valuesToInsert)
      .onConflictDoNothing(); // Important for idempotency or race conditions
    console.log(`Successfully linked task ${taskId} to ${sourceIds.length} sources.`);
  } catch (error) {
    console.error(`Error linking task ${taskId} to sources:`, error);
    // Depending on requirements, you might want to throw the error
    // throw new Error(`Failed to link task ${taskId} to sources.`);
  }
};

// NEW function to link a task to multiple documents using their UUIDs
export const linkTaskToDocuments = async (taskId: number, documentUuids: string[]): Promise<void> => {
  if (!documentUuids || documentUuids.length === 0) {
    console.log(`No document UUIDs provided for task ${taskId}. Skipping link.`);
    return;
  }

  // 1. Fetch document ID-UUID pairs by UUIDs
  const documentIdPairs = await getDocumentIdPairsByUuids(documentUuids);
  const documentIds = documentIdPairs.map(pair => pair.id);

  if (documentIds.length === 0) {
    console.log(`No valid documents found for the provided UUIDs for task ${taskId}. Skipping link.`);
    return;
  }

  if (documentIds.length !== documentUuids.length) {
    console.warn(`Task ${taskId}: Not all provided document UUIDs were found. Found ${documentIds.length} out of ${documentUuids.length}.`);
  }

  // 2. Prepare values for insertion using the fetched document IDs
  const valuesToInsert = documentIds.map(docId => ({
    task_id: taskId,
    document_id: docId,
  }));

  // 3. Insert links into the junction table
  try {
    // Use insert with onConflictDoNothing to avoid errors if the link already exists
    await db.insert(tasks_to_documents)
      .values(valuesToInsert)
      .onConflictDoNothing(); // Important for idempotency or race conditions
    console.log(`Successfully linked task ${taskId} to ${documentIds.length} documents.`);
  } catch (error) {
    console.error(`Error linking task ${taskId} to documents:`, error);
    // throw new Error(`Failed to link task ${taskId} to documents.`);
  }
};

// Add more methods as needed, e.g., find specific tasks, delete tasks
// Remove the class definition and exported instance 