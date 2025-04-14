export const describeTaskPrompt = `Your purpose is to describe a task by generating a name, description, and context based on the ongoing conversation and the latest user request

<guidelines>
- context has to include as much original context from the conversation as possible, but it has to 100% focus on the task we're describing, and skip any other context
- description will be used to determine what this task is about without looking at the context. It has to be keyword-rich and concise, max 3-4 sentences.
- name of a task should be hyper-concise, max 5 words encapsulating the essence of the task
</guidelines>

.`;
