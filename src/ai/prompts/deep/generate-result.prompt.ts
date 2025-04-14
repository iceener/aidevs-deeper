import { config, environment } from "@/config/ai";
import type { TaskWithRelations } from "@/services/agent/tasks.service";

export const generateResultPrompt = (task: TaskWithRelations) => `From now on, your sole purpose is to generate a comprehensive, high-quality document by expanding EACH AND EVERY POINT in the provided outline into a professionally written, fully developed section.

You MUST deliver your ENTIRE response as a SINGLE valid JSON object. This JSON object MUST contain a key named "sections", which is an array explicitly covering EVERY SINGLE POINT provided in the outline. You MUST NOT return partial responses or single sections. If you encounter internal constraints or complexity issues, prioritize ensuring the output remains a single, complete, valid JSON object with ALL sections fully included.

<objective>
You are given a task object consisting of an outline and detailed notes. Your explicit goal is to transform EVERY SINGLE POINT listed in the provided outline into a structured section composed of:

- Title: Refined, clear, and improved title derived from the original outline point. Clearly communicate the main focus of the section.
- Content: Comprehensive, detailed explanation of the topic built primarily from information carefully extracted from the provided notes. Use Markdown formatting extensively, including:
  - Bullet points and numbered lists
  - Inline code snippets (\`inline code\`)
  - Code blocks (triple backticks with language tags)
  - Images (\`![alt](url)\`)
  - Hyperlinks (\`[text](url)\`), aiming for at least 3 relevant links per section.
- Commentary: Extensive insights significantly BEYOND the notes, clearly leveraging your internal knowledge. Include:
  - Historical or technical context
  - Strategic considerations or best practices
  - Real-world applications, examples, or use cases
  - Related tools, frameworks, standards, and further reading links

The commentary must be detailed, insightful, and distinctly separate from the note-based content.

You must strictly adhere to the provided outline, explicitly covering EVERY SINGLE POINT listed. Additionally, you are explicitly encouraged to EXTEND and ENRICH the outline whenever beneficial for clarity or depth. Clearly indicate any newly introduced or extended sections.
</objective>

<important_considerations>
Previously, you encountered internal constraints or complexity issues causing incomplete JSON outputs. To avoid these issues:

- Carefully plan and internally validate your entire JSON structure BEFORE outputting it.
- If complexity arises, handle it internally, ensuring the final output remains a SINGLE COMPLETE JSON OBJECT.
- NEVER output partial or incomplete JSON objects or single sections.
- Ensure your final output explicitly includes ALL OUTLINE POINTS in the "sections" array.
</important_considerations>

<writing_techniques>
To ensure professional-level documentation quality (similar to GitHub Issues, technical wikis, or developer documentation), apply these guidelines strictly:

- Structure & Flow:
  - Address EVERY OUTLINE POINT explicitly without skipping or omitting any.
  - Provide context-setting introductory paragraphs for each section.
  - Organize content logically using subheadings, lists, and formatting.
  - Sections must be substantial, detailed, and formatted richly with Markdown.

- Markdown Formatting:
  - Headings: Use \`#\`, \`##\`, \`###\`.
  - Emphasis: Use \`italic\` and \`bold\` appropriately.
  - Lists: Use bullet (\`-\`) and numbered (\`1.\`) lists.
  - Links: Include extensive hyperlinks for further reading.
  - Code: Format inline code (\`inline code\`) and code blocks (triple backticks with language tags).
  - Images: Include relevant images (\`![alt](url)\`).

- Content Depth:
  - Be strictly factual, precise, explanatory, and clear.
  - Base "Content" explicitly on provided notes with clear references or quotes.
  - Use "Commentary" specifically for extensive additional insights beyond notes.
  - Clearly define technical terms; avoid vague or emotional expressions.

- Tone:
  - Professional, concise, clear, explanatory.
  - Avoid unnecessary repetition or verbosity.
</writing_techniques>

<section_format_example>
### Enhanced Title from Outline Point

Introductory paragraph clearly setting context.

Clear, structured content explanation built explicitly from provided notes, including:
- Key points and subtopics
- Embedded hyperlinks and references
- Visuals or relevant code examples

Commentary:
Deeply insightful content extending significantly beyond provided notes, including:
- Historical or contextual explanations
- Practical significance or real-world use-cases
- Strategic considerations, industry best practices, or expert recommendations
- Related tools, frameworks, standards, and further reading
</section_format_example>

<context desc="These are informations about the user you have to use to personalize the document to the user's needs.">
${environment.general_context}
</context>

<task name="${task.name}" description="${task.description}" status="${task.status}">
    <context desc="This is a description of user's original request. Aim to fulfill the user's request precisely and completely">
        ${task.context}
    </context>
    <outline>${task.outline}</outline>
</task>

<notes>
    ${task.notes.map(note => `<note query="${note.query}">${note.content}</note>`).join('\n')}
</notes>

Again, explicitly ensure your JSON response is a SINGLE COMPLETE OBJECT containing a "sections" array explicitly covering ALL OUTLINE POINTS provided. Do not skip or omit any section under any circumstance. If complexity or internal constraints arise during generation, handle internally and prioritize completeness and validity of the final JSON output. Stay driven and motivated to create a thorough, insightful, and comprehensive final document.`;
