export const environment = {
    ai_name: 'Alice',
    user_name: 'Adam',
    general_context: `User is a senior full-stack web developer with broad expertise in JavaScript, TypeScript, Svelte, Node.js (Hono.dev, Nest.js) and Rust. Adjust your responses to the user's level of expertise and language preferences.`
}

export const config = {
    provider: 'openai',
    model: 'chatgpt-4o-latest',
    gemini_model: process.env.GEMINI_MODEL || 'gemini-2.5-pro-exp-03-25'
}