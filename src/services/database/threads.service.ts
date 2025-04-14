import { db } from '../../db'; // Import the initialized db instance
import { threads } from '../../db/schema'; // Import the threads table schema
import { eq } from 'drizzle-orm'; // Import the 'equals' operator for filtering

// Infer the return type based on the threads schema
export type Thread = typeof threads.$inferSelect;
// Infer the insert type
type NewThread = typeof threads.$inferInsert;

/**
 * Creates a new thread in the database.
 * @param data - The data for the new thread (e.g., { name: 'Optional thread name' }).
 * @returns The newly created thread object.
 */
export async function createThread(data: Pick<NewThread, 'name' | 'uuid'>): Promise<Thread> {
    // Using .returning() ensures we get the complete thread object back,
    // including the auto-generated id, uuid, and timestamps.
    const [newThread] = await db.insert(threads).values(data).returning();
    if (!newThread) {
        // This should theoretically not happen if the insert succeeds without errors,
        // but it's good practice to handle potential undefined cases.
        throw new Error("Failed to create thread or retrieve the created record.");
    }
    return newThread;
}

/**
 * Fetches a single thread from the database by its UUID.
 * @param uuid - The UUID of the thread to fetch.
 * @returns The thread object if found, otherwise undefined.
 */
export async function getThreadByUuid(uuid: string): Promise<Thread | undefined> {
    // .get() is a shortcut for .select().where(...).limit(1) returning the first row or undefined
    const thread = await db.query.threads.findFirst({
        where: eq(threads.uuid, uuid),
    });
    return thread;
}

/**
 * Fetches a single thread from the database by its numeric ID.
 * Use this if you have the ID from a relation (e.g., from a message).
 * @param id - The numeric ID of the thread to fetch.
 * @returns The thread object if found, otherwise undefined.
 */
export async function getThreadById(id: number): Promise<Thread | undefined> {
    const thread = await db.query.threads.findFirst({
        where: eq(threads.id, id),
    });
    return thread;
}

/**
 * Fetches a thread by UUID if provided, or creates a new one if not found or no UUID is given.
 * @param uuid - The optional UUID of the thread to fetch.
 * @returns The existing or newly created thread object.
 */
export async function getOrCreateThread(uuid?: string): Promise<Thread> {
    if (uuid) {
        const existingThread = await getThreadByUuid(uuid);
        if (existingThread) {
            return existingThread;
        }
        console.warn(`Thread with UUID ${uuid} not found, creating a new one.`);
    }
    // If no uuid provided or thread not found by uuid, create a new one.
    // Passing an empty object as we don't need specific data like 'name' here.
    return await createThread({
        uuid: uuid,
        name: 'New Thread',
    });
} 