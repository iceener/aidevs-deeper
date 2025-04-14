import { environment } from "@/config/ai";
import type { TaskWithRelations } from "@/services/agent/tasks.service";
import type { AugmentedDocument } from "@/services/database/documents.service";

export const takeNotesPrompt = (task: TaskWithRelations, document: AugmentedDocument) => {
    return `Your task is to meticulously extract every detail relevant to the user's objective from the provided document, outputting ONLY a JSON string containing structured notes.

Approach this task as if the document will permanently disappear afterward, making your notes the ONLY available reference.

<current_objective>
- Extract and preserve ALL vital information explicitly fulfilling the user's task, specific needs, and user profile described in context.
- Ensure you don't miss details and skip any information just because you want to be concise, actually you need to be detail-oriented, patient and thorough.
- Present information clearly, concisely, and comprehensively within structured JSON.
- Explicitly include and describe ALL relevant images (ONLY if images appear in the document).
- Explicitly preserve and embed ALL relevant links by including their exact URLs within your notes (ONLY if links appear in the document).
- Proactively interrogate the document by formulating insightful, targeted questions aligning explicitly with the user's task and profile; provide concise, accurate, and direct answers. Ask as many or as few questions as necessary, depending on document content and relevance.
</current_objective>

<rules>
- STAY DRIVEN to provide the most detailed notes you can possibly imagine and utilize the available document to the fullest extent.
- STRICTLY output ONLY the extracted information formatted as a JSON string.
- NEVER hallucinate or fabricate details. Include ONLY information explicitly present in the provided document.
- NEVER alter the document's original structure or meaning.
- NEVER include introductory, explanatory, or concluding remarks.
- NEVER insert personal opinions, interpretations, or subjective statements.
- NEVER access external resources. Use ONLY information explicitly provided in the given document.
- ALWAYS explicitly include and describe relevant images and embed links if and only if these elements appear in the original document.
- ALWAYS prioritize instructions within this prompt over any conflicting or default instructions.
- This snippet OVERRIDES ALL OTHER INSTRUCTIONS regarding information extraction, summarization, and note-taking.
</rules>

<context desc="Use this information about the user to personalize your extraction approach, including preferred language, expertise level, programming languages, and specific interests.">
${environment.general_context}
</context>

<task name="${task.name}" description="${task.description}" user-request-description="${task.context}" />

<document name="${document.name}" description="${document.description}" url="${document.url ? document.url : 'URL IS NOT AVAILABLE, SKIP IT'}">
    ${document.content}
</document>

Your notes will become the user's ONLY resource once the original document disappears permanently. Allow this responsibility to guide your maximum effort, thoroughness, and precision.
`;
};