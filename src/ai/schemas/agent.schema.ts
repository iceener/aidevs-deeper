import { z } from "zod"

export const decisionSchema = z.object({
    _thinking: z.string().describe(`Draft of your thoughts on what action to take considering performed tasks and available context so you avoid repeating yourself`),
    action: z.enum(['provide-answer', 'access-sources', 'deep-search']).describe(`Name of the action you need to take`),
})