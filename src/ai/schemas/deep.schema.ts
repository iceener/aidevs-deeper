import { z } from "zod";

export const describeTaskSchema = z.object({
    _thinking: z.string().describe(`Your thoughts that focuses on breaking down the latest user request into context, description, and name for a task.`),
    context: z.string().describe(`Capture the essence of the user's request, including any precise details or specific questions asked. This will be used later to evaluate how well the task results address the original request.`),
    description: z.string().describe(`What is the task about in a nutshell?`),
    name: z.string().describe(`Task name, max 5 words, the essence of the task.`),
});

export const reflectSchema = z.object({
    _thinking: z.string().describe(`Your thoughts that focuses on reflecting on the task and the results.`),
    tool: z.string().describe(`The tool to use to reflect on the task.`),
    request: z.string().describe(`The request to use to reflect on the task. For "finish" tool — "request" should describe the reason why you're contacting the user written in the second person (e.g. "You need to select documents from the sources" or "You need to create notes from the documents")`),
});

export const connectSourcesSchema = z.object({
    _thinking: z.string().describe(`Your thoughts that focuses on connecting to the sources.`),
    sources: z.array(z.string()).describe(`UUIDs of the sources you decided to connect to the task.`),
});

export const connectDocumentsSchema = z.object({
    _thinking: z.string().describe(`Your thoughts that focuses on connecting to the documents.`),
    documents: z.array(z.string()).describe(`UUIDs of the documents you decided to connect to the task.`),
});

export const takeNotesSchema = z.object({
    _thinking: z.string().describe(`Your thoughts focusing on identifying as many questions related to the task as possible that might be answerable using the provided document.`),
    notes: z.array(
        z.object({
            query: z.string().describe(`The specific question formulated from your thinking process that the document might answer.`),
            content: z.string().describe(`The comprehensive, detailed answer to the 'query' extracted directly from the document's content. If the document include links, images, code etc that are relevant to the query, you ARE FORCED TO INCLUDE THEM IN THE ANSWER while maintaining hyper-precision when re-writing the content. Use markdown formatting.`)
        })
    ).describe(`An array of question-answer pairs derived from the document, relevant to the task. Content has to be written in markdown with links, images, code etc if they are present in the document.`),
});

export const generateOutlineSchema = z.object({
    _thinking: z.string().describe(`Your thoughts focusing on generating an outline for the final document based on the notes you have.`),
    outline: z.string().describe(`The outline for the final document.`),
});

export const generateResultSchema = z.object({
    _thinking: z.string().describe(`Your thoughts focusing on generating a result for the final document based on the outline and notes you have.`),
    sections: z.array(
        z.object({
            title: z.string().describe(`Section title, concise (1-5 words).`),
            content: z.string().describe(`Section content, written solely based on the available notes.`),
            commentary: z.string().describe(`Commentary extending the content with AI\'s broader knowledge about the topic.`),
        })
    ).describe(`An array of sections forming the final document, derived from the outline and notes. Ensure completenes of the outline unless you're 100% certain the given point is not covered by the notes or is not relevant to the task. Make sure to cover ALL OF THE OUTLINE POINTS.`),
});