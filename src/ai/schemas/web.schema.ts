import { z } from "zod";

export const webSearchQueriesSchema = z.object({
   _thinking: z.string().describe("Your thoughts on generating the web search queries based on the user's request."),
   queries: z.array(z.string()).describe(`List of web-search friendly queries.`),
})
