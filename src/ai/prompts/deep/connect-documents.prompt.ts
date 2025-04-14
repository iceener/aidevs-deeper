import { environment } from "@/config/ai"
import type { TaskWithRelations } from "@/services/agent/tasks.service"
import type { Document } from "@/services/database/documents.service"

export const connectDocumentsPrompt = (task: TaskWithRelations, documents: Document[]) => {
    return `Your sole purpose is to understand the ongoing conversation, the deep search task you're working on, and the user's latest request—then use this information to connect to the most relevant documents.

    <rules>
        - Connect to all documents that are relevant to the conversation and the user's request
        - Add documents that may include information relevant to the user's profile described below (for example related to the user's expertise, programming languages, etc.)
    </rules>
    <task name="${task.name}" description="${task.description}" context="${task.context}">
      <already-connected-documents>
        ${task.tasksToDocuments ? task.tasksToDocuments.map(taskToDocument => `<document uuid="${taskToDocument.document.uuid}" path="${taskToDocument.document.path}" name="${taskToDocument.document.name}" type="${taskToDocument.document.type}">${taskToDocument.document.name}</document>`).join('\n') : 'No documents connected yet.'}
      </already-connected-documents>
    </task>

    <user-profile desc="Use this information about the user to personalize documment selection approach, including preferred language, expertise level, programming languages, and specific interests">
        ${environment.general_context}
    </user-profile>
    
    <available-documents>
    ${documents.map(document => `<document uuid="${document.uuid}" path="${document.path}" name="${document.name}" type="${document.type}">${document.name}</document>`).join('\n')}
    </available-documents>

    Ensure that you connect all documents relevant to the conversation, user-profile and the task. Carefully write the UUIDs of the documents you connect to ensure that they are correct and comes from the available-documents list. Note: it's better to connect document you are not sure if it's relevant than to skip it.`
}