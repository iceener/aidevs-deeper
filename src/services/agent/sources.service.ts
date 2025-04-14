import { db } from "../../db"; // Assuming db connection setup is here
import { sources, documents } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import type { Document } from "@/services/database/documents.service"; // Import Document type

// Define Input/Output types based on schema (adjust as needed)
type NewSource = typeof sources.$inferInsert;
export type Source = typeof sources.$inferSelect;

// Define type for source with documents
export type SourceWithDocuments = Source & { documents: Document[] };

export const createSource = async (data: NewSource): Promise<Source | undefined> => {
  const [newSource] = await db.insert(sources).values(data).returning();
  return newSource;
}

export const getSourceById = async (id: number): Promise<Source | undefined> => {
  const [source] = await db.select().from(sources).where(eq(sources.id, id));
  return source;
}

export const findSourceByOrigin = async (origin: string): Promise<Source | undefined> => {
  const [source] = await db.select().from(sources).where(eq(sources.origin, origin));
  return source;
}

export const listSources = async (): Promise<SourceWithDocuments[]> => {
  // Use db.query to fetch sources with their related documents
  const results = await db.query.sources.findMany({
      with: {
          documents: true // Include the documents relation
      }
  });
  // Drizzle should infer the correct type, but cast if necessary
  return results as SourceWithDocuments[];
}

// NEW Function: Get Source ID by UUID
export const getSourceIdByUuid = async (uuid: string | undefined): Promise<number | undefined> => {
  // Check if uuid is undefined before attempting database query
  if (!uuid) {
    console.warn("getSourceIdByUuid called with undefined UUID");
    return undefined;
  }

  try {
    const result = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.uuid, uuid))
      .limit(1); // Ensure only one result is returned

    return result[0]?.id; // Return the id or undefined if not found
  } catch (error) {
    console.error(`Error fetching source ID for UUID ${uuid}:`, error);
    throw new Error(`Failed to fetch source ID for UUID ${uuid}.`);
  }
};

// Fetch multiple sources by their UUIDs
export const getSourcesByUuids = async (uuids: string[]): Promise<Source[]> => {
  if (!uuids || uuids.length === 0) {
    return [];
  }
  try {
    const results = await db
      .select()
      .from(sources)
      .where(inArray(sources.uuid, uuids));
    // Log the result count here for debugging
    console.log(`getSourcesByUuids: Found ${results.length} sources for UUIDs: ${uuids.join(', ')}`);
    return results;
  } catch (error) {
    console.error(`Error fetching sources for UUIDs ${uuids.join(', ')}:`, error);
    throw new Error(`Failed to fetch sources for UUIDs.`);
  }
}

// Fetch multiple sources by their UUIDs along with their documents
export const getSourcesWithDocumentsByUuids = async (uuids: string[]): Promise<SourceWithDocuments[]> => {
  if (!uuids || uuids.length === 0) {
    return [];
  }
  try {
    const results = await db.query.sources.findMany({
        where: inArray(sources.uuid, uuids),
        with: {
            documents: true 
        }
    });
    return results as SourceWithDocuments[];
  } catch (error) {
    console.error(`Error fetching sources with documents for UUIDs ${uuids.join(', ')}:`, error);
    throw new Error(`Failed to fetch sources with documents.`);
  }
}

// Add more methods as needed, e.g., updateSource, deleteSource
// Remove the class definition and exported instance 