import type { TaskWithRelations } from "@/services/agent/tasks.service";
import type { Tool } from "@/types/deep";

export const reflectPrompt = (task: TaskWithRelations, tools: Tool[]) => {
    return `Your purpose is to decide on what to do next in the deep search process described below.

    <rules>
        - Decide what to do next while keeping track on "performed-steps" because they will inform you about what you have already done and what are the results of the performed steps
        - When on performed steps you see that you have already performed the step with no results and you're unable to continue, you need to use the "finish" tool to contact the user. For example you may not have sources / documents required to continue the deep search.
        - You are allowed to use only the tools that are listed in the "available-tools" section
        - You are not allowed to extend your database so if you attempted to load sources/documents/notes but they aren't sufficient to start the deep search you need to use the "finish" tool to contact the user.
        - When you're done, don't know what to do or need to contact the user, use the "finish" tool
        - When using "finish" tool — "request" should describe the reason why you're contacting the user written in the second person.
    </rules>

    <deep-search-task name="${task.name}" description="${task.description}" status="${task.status}">
        <sources desc="These are the sources you decided to use for the deep search.">
            ${task.tasksToSources && task.tasksToSources.length > 0 ? task.tasksToSources.map(source => `<source name="${source.source.name}" url="${source.source.origin}" />`).join('\n') : 'No sources available. To perform deep search you need to connect to the sources first using the "select-sources" tool.'}
        </sources>

        <documents desc="These are the documents you decided to use for the deep search.">
            ${task.tasksToDocuments && task.tasksToDocuments.length > 0 ? task.tasksToDocuments.map(document => `<document name="${document.document.name}" url="${document.document.url}" />`).join('\n') : `No documents available. ${task.tasksToSources ? 'You need to connect to the sources first.' : 'As you already have sources connected, you need to select documents from the sources using the "select-documents" tool.'}`}
        </documents>

        <notes desc="These are the notes you decided to use for the deep search.">
            ${task.notes && task.notes.length > 0 ? task.notes.map(note => `<note query="${note.query}" content="${note.content}" />`).join('\n') : `No notes available. ${task.tasksToDocuments ? 'You need to create notes from the documents first.' : 'As you already have documents connected, you need to create notes from the documents using the "create-notes" tool.'}`}
        </notes>

        <outline>
            ${task.outline ? task.outline : `No outline available. ${task.notes ? 'You need to create notes from the documents first.' : 'As you already have notes created, you can generate an outline using the "generate-outline" tool.'}`}
        </outline>
            
        <performed-steps>
            ${task.steps.map(step => `<step name="${step.name}" request="${step.request}" results="${step.results}" />`).join('\n')}
        </performed-steps>
    </deep-search-task>

    <available-tools desc="These are the tools you can use to perform the next step of the deep search process.">
        ${tools.map(tool => `<tool name="${tool.name}" description="${tool.description}" />`).join('\n')}
    </available-tools>
    
    Remember — you can perform actions only with the tools listed above and you can't answer beyond knowledge from the sources/documents/notes you have access to.`
}