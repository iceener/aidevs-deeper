import { db } from "@/db";
import { steps } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Type for inserting a new step (omit id, uuid, timestamps)
type CreateStepInput = Omit<InferInsertModel<typeof steps>, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>;

// Type for the step model returned by SELECT queries
export type Step = InferSelectModel<typeof steps>;

/**
 * Creates a new step record in the database.
 * @param data - The data for the new step.
 * @returns The newly created step object.
 */
export const createStep = async (data: CreateStepInput): Promise<Step | null> => {
  try {
    const [newStep] = await db.insert(steps).values(data).returning();
    return newStep || null;
  } catch (error) {
    console.error("Error creating step:", error);
    // Consider more specific error handling or re-throwing
    return null;
  }
};

// Type for updating an existing step (require id, partial other fields)
type UpdateStepInput = Partial<Omit<CreateStepInput, 'task_id'> & { task_id?: number }>; // task_id can't be updated usually, but allow if needed

/**
 * Updates an existing step record.
 * @param stepId - The ID of the step to update.
 * @param data - The data to update.
 * @returns The updated step object, or null if not found or error.
 */
export const updateStep = async (
  stepId: number,
  data: UpdateStepInput
): Promise<Step | null> => {
  if (Object.keys(data).length === 0) {
    console.warn("Update called with no data for step:", stepId);
    // Optionally fetch and return the existing step without changes
    const [existingStep] = await db.select().from(steps).where(eq(steps.id, stepId));
    return existingStep || null;
  }

  try {
    const [updatedStep] = await db
      .update(steps)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(steps.id, stepId))
      .returning();

    return updatedStep || null; // Return null if step with stepId wasn't found
  } catch (error) {
    console.error(`Error updating step with ID ${stepId}:`, error);
    // Consider more specific error handling
    return null;
  }
};