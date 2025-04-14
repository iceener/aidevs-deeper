import { db } from '../../db'; // Import the initialized db instance
import { messages, threads } from '../../db/schema'; // Import schemas
import { eq } from 'drizzle-orm'; // Import operators

// Infer types from schema
export type Message = typeof messages.$inferSelect;
type NewMessage = typeof messages.$inferInsert;

/**
 * Creates a new message associated with a thread ID.
 * @param data - The data for the new message ({ threadId, role, content }).
 * @returns The newly created message object.
 */
export async function createMessage(data: Pick<NewMessage, 'threadId' | 'role' | 'content'>): Promise<Message> {
    // Ensure the referenced thread exists before creating the message
    // Note: This check adds an extra query. Depending on your needs,
    // you might rely on foreign key constraints or handle potential
    // errors during insertion if the threadId is invalid.
    const threadExists = await db.query.threads.findFirst({
        where: eq(threads.id, data.threadId),
        columns: { id: true } // Only select the id column for efficiency
    });

    if (!threadExists) {
        throw new Error(`Cannot create message: Thread with ID ${data.threadId} not found.`);
    }

    const [newMessage] = await db.insert(messages).values(data).returning();
     if (!newMessage) {
        throw new Error("Failed to create message or retrieve the created record.");
    }
    return newMessage;
}

/**
 * Fetches a single message from the database by its UUID.
 * @param uuid - The UUID of the message to fetch.
 * @returns The message object if found, otherwise undefined.
 */
export async function getMessageByUuid(uuid: string): Promise<Message | undefined> {
    const message = await db.query.messages.findFirst({
        where: eq(messages.uuid, uuid),
    });
    return message;
}

/**
 * Fetches all messages associated with a specific thread, ordered by creation time.
 * @param threadId - The numeric ID of the thread.
 * @returns An array of message objects.
 */
export async function getMessagesByThreadId(threadId: number): Promise<Message[]> {
    const threadMessages = await db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)], // Order by creation time ascending
    });
    return threadMessages;
}

/**
 * Fetches all messages associated with a specific thread UUID, ordered by creation time.
 * This involves an extra step to find the thread ID first.
 * @param threadUuid - The UUID of the thread.
 * @returns An array of message objects, or undefined if the thread is not found.
 */
export async function getMessagesByThreadUuid(threadUuid: string): Promise<Message[] | undefined> {
    // 1. Find the thread by UUID to get its numeric ID
    const thread = await db.query.threads.findFirst({
        where: eq(threads.uuid, threadUuid),
        columns: { id: true }, // Only need the ID
    });

    if (!thread) {
        return undefined; // Thread not found
    }

    // 2. Fetch messages using the found thread ID
    return getMessagesByThreadId(thread.id);
} 