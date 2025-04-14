import type { Source } from "@/services/agent/sources.service"
import type { TaskWithRelations } from "@/services/agent/tasks.service"
export const connectSourcesPrompt = (task: TaskWithRelations, sources: Source[]) => {
    return `Your sole purpose is to understand the ongoing conversation, the deep search task you're working on, and the user's latest request—then use this information to connect to the most relevant sources.

    <task name="${task.name}" description="${task.description}" context="${task.context}">
      <already-connected-sources>
        ${task.tasksToSources ? task.tasksToSources.map(taskToSource => `<source uuid="${taskToSource.source.uuid}" origin="${taskToSource.source.origin}" description="${taskToSource.source.description}">${taskToSource.source.name}</source>`).join('\n') : 'No sources connected yet.'}
      </already-connected-sources>
    </task>

    <available-sources>
    ${sources.map(source => `<source uuid="${source.uuid}" origin="${source.origin}" description="${source.description}">${source.name}</source>`).join('\n')}
    </available-sources>
    
    Ensure that you only connect to the sources that are relevant to the conversation and the user's request and the UUIDs are carefully rewritten without any typos and comes from the available-sources list.
    `
}