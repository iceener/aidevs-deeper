import { drizzle } from "drizzle-orm/libsql";
import { createClient } from '@libsql/client';
import { sources, documents } from "./schema";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";

// Define a type for document that will be uploaded
type DocumentToSeed = {
  name: string;
  type: "local" | "external" | "generated";
  source_id: number;
  originalPath: string;
  url: string | null;
  description: string | null;
};

// Generate document paths for storage
const generateDocumentPaths = (
  uuid: string,
  originalFilename: string,
): { relativePath: string; fullDirPath: string } => {
  const DOCUMENTS_ROOT = path.resolve(process.cwd(), "documents");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateDir = `${year}-${month}-${day}`;

  // Directory structure: yyyy-mm-dd/document-uuid/
  const relativeDir = path.join(dateDir, uuid);
  const safeOriginalFilename = path.basename(originalFilename);
  const relativePath = path.join(relativeDir, safeOriginalFilename);
  const fullDirPath = path.resolve(DOCUMENTS_ROOT, relativeDir);

  return { relativePath, fullDirPath };
};

const main = async () => {
  // Get database URL from environment
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  
  console.log("Connecting to database:", dbUrl);
  
  // Create libsql client
  const client = createClient({
    url: dbUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN, // Add if connecting to Turso
  });
  
  // Initialize Drizzle with the LibSQL client
  const db = drizzle(client);

  console.log("Starting to seed sources...");

  // Insert the source(s)
  const sourceData = [
    {
      uuid: uuidv4(),
      name: "AI Devs Course — Connect LLM to your application logic",
      type: "file" as const,
      origin: "aidevs.pl", // Assuming general domain for the course source
      description: "AI_devs is an online course about using Generative AI (especially LLMs) within the application logic and building AI Agents.",
    },
    {
      uuid: uuidv4(),
      name: "OpenAI Platform",
      type: "file" as const,
      origin: "platform.openai.com", // General domain for OpenAI docs
      description: "OpenAI API documentation and platform resources",
    },
    {
      uuid: uuidv4(),
      name: "FireCrawl — web scraping and crawling tool",
      type: "file" as const,
      origin: "firecrawl.dev", // General domain for FireCrawl docs
      description: "FireCrawl is a powerful web scraping and crawling tool designed for AI applications, providing capabilities for content extraction, site mapping, and deep research.",
    }
  ];
  const sourceResults = await db.insert(sources).values(sourceData).returning();

  console.log(`✅ Successfully seeded ${sourceResults.length} sources:`);
  for (const source of sourceResults) {
    console.log(`- ${source.name} (ID: ${source.id}): ${source.origin}`);
  }

  // Find the IDs of the newly created sources
  const aiDevsSource = sourceResults.find(s => s.origin === "aidevs.pl");
  const openAiSource = sourceResults.find(s => s.origin === "platform.openai.com");
  const fireCrawlSource = sourceResults.find(s => s.origin === "firecrawl.dev");

  // --- Seed Documents ---
  if (aiDevsSource && openAiSource && fireCrawlSource) {
    console.log("Starting to seed documents linked to the sources...");

    const documentsToSeed: DocumentToSeed[] = [
      {
        name: "OpenAI API: Chat Completion",
        type: "local",
        source_id: openAiSource.id,
        originalPath: "./knowledge/docs/openai-chat-completion.md",
        url: "https://platform.openai.com/docs/api-reference/chat",
        description: `This API reference documents the OpenAI Chat Completions endpoint (POST /v1/chat/completions) for conversational responses. Details parameters: required (messages, model), optional (temperature, top_p, frequency/presence penalties, response_format for Structured Outputs including JSON Mode/Schema). Covers advanced features: function/tool calling, streaming (SSE), token probability logging (logprobs), seed for determinism (system_fingerprint). Explains Chat Completion object/chunk structures, streaming implementation. Notes on reasoning models, content moderation with streaming, service tier selection. *Keywords: OpenAI API, Chat Completions, API Reference, POST /v1/chat/completions, Conversational AI, Parameters, Messages, Model, GPT-4o, Temperature, Top_p, Frequency Penalty, Presence Penalty, Response Format, JSON Mode, JSON Schema, Structured Outputs, Function Calling, Tool Calling, Streaming Responses, Server-Sent Events, SSE, Token Probability, Logprobs, Seed, Determinism, System Fingerprint, Chat Completion Object, Chat Completion Chunk, Reasoning Models, Content Moderation, Service Tier.*`,
      },
      {
        name: "OpenAI API: Chat Completion Streaming",
        type: "local",
        source_id: openAiSource.id,
        originalPath: "./knowledge/docs/openai-chat-completion-streaming.md",
        url: "https://platform.openai.com/docs/api-reference/streaming",
        description: `This technical guide covers implementing streaming responses with OpenAI's Chat Completions API for real-time partial outputs via server-sent events (SSE). Details enabling streaming (stream=true) and processing incremental chunks. Documents the Chat Completion Chunk object structure (id, object, created, model, system_fingerprint, choices array with delta objects containing role, content, tool_calls). Includes Python examples for iteration/concatenation. References advanced uses (streaming function calls, structured output). Notes content moderation challenges. *Keywords: OpenAI API, Chat Completions, Streaming Responses, Real-Time, Server-Sent Events, SSE, stream=true, Incremental Content, Chat Completion Chunk, Delta Object, Python Examples, Function Call Streaming, Structured Output Streaming, Content Moderation.*`,
      },
      {
        name: "OpenAI API: Response API",
        type: "local",
        source_id: openAiSource.id,
        originalPath: "./knowledge/docs/openai-response-api.md",
        url: "https://platform.openai.com/docs/api-reference/responses",
        description: `The OpenAI Responses API documentation details a next-gen interface for conversational apps, unifying capabilities like rich inputs (text, images, files), automatic streaming via semantic events, integrated tool usage (function calling, built-in tools), and file operations (upload, processing, reference). Covers endpoints (/v1/responses), request parameters (input, model, tools, previous_response_id for conversation state), response structure (output, usage). Details message formats, advanced capabilities like file handling, structured output (response_format with JSON Schema), and distinct streaming events. Includes example code. *Keywords: OpenAI API, Responses API, Next-Generation Interface, Conversational Applications, Rich Inputs, Text Input, Image Input, File Input, Automatic Streaming, Tool Usage, Function Calling, File Handling, Upload, Processing, Reference, Endpoints, /v1/responses, Request Parameters, Response Structure, Prompt Feedback, Usage Statistics, Message Format, Tool Outputs, Structured Output, response_format, JSON Schema, Semantic Events, Streaming Events, Conversation State, previous_response_id.*`,
      },
      // Document for FireCrawl Source
      {
        name: "FireCrawl: Web Scraping and Crawling Tool",
        type: "local", 
        source_id: fireCrawlSource.id,
        originalPath: "./knowledge/docs/firecrawl.md",
        url: "https://firecrawl.dev/docs",
        description: `This API documentation details Firecrawl's web scraping/crawling for AI apps. The /v1/scrape endpoint converts pages to clean, structured data (LLM-ready), handling proxies, JS rendering, dynamic content. Covers parameters: url, formats (markdown, html, rawHtml, screenshot, links, extract), structured data extraction (LLM, JSON Schema, Prompt), page interaction (Actions: click, scroll, write, wait, press), geolocation. Advanced features: batch scraping (/v1/batch/scrape), content extraction (selectors), browser automation. Includes search endpoint (/v0/search), TypeScript examples, response structures, error handling. Manages rate limits, caching, proxies. *Keywords: Firecrawl API, Web Scraping, Web Crawling, AI Applications, Structured Data, LLM-Ready Data, Proxy Management, JavaScript Rendering, Dynamic Content Loading, Endpoint, /v1/scrape, Output Formats, markdown, html, rawHtml, screenshot, links, extract, Structured Data Extraction, LLM, JSON Schema, Prompt, Page Interaction, Actions, click, scroll, write, wait, press, Geolocation, Batch Scraping, /v1/batch/scrape, Content Extraction, Selectors, Browser Automation, Search Endpoint, /v0/search, TypeScript Integration, API Key, Rate Limiting, Caching, Proxy Rotation.*`
      },
      // Document for FireCrawl Source - Firecrawl Extract
      {
        name: "FireCrawl: Extract API",
        type: "local", 
        source_id: fireCrawlSource.id,
        originalPath: "./knowledge/docs/firecrawl-extract.md",
        url: "https://firecrawl.dev/docs/extract",
        description: `Comprehensive guide to Firecrawl's /extract endpoint for structured data extraction from any number of URLs or entire domains. Details asynchronous extraction from single pages (https://example.com) or entire domains using wildcards (https://example.com/*). Features schema-based extraction with Zod support, enabling precise data structuring through JSON schemas. Covers key parameters: urls array, prompt (description of desired data), schema (JSON structure definition), enableWebSearch (contextual enhancement). Includes SDK examples for Python, Node.js, cURL implementations. Details job management: asyncExtract for immediate job ID return, getExtractStatus for progress checking. Explains response status possibilities (completed, processing, failed, cancelled) with examples. Supports schema-less extraction via natural language prompts for flexible data gathering. Advanced capabilities include web search integration for enriched context from linked pages. Mentions alpha features for URL-less extraction based on search capability. Lists current limitations and billing practices. *Keywords: Firecrawl API, /extract Endpoint, Structured Data Extraction, Web Scraping, Web Crawling, JSON Schema, Zod, API Integration, Asynchronous Jobs, Job Management, Status Checking, Wildcard URLs, Domain Crawling, Schema-based Extraction, Prompt-based Extraction, Python SDK, Node.js SDK, JavaScript Integration, Web Search Enhancement, Linked Page Context, URL-less Extraction, Data Structuring, LLM-powered Extraction, Batch Processing, Job ID, Context Enrichment, Task Progress, Response Structure, Expiration Handling, Business Intelligence.*`
      },
      // Document for FireCrawl Source - Firecrawl JS
      {
        name: "FireCrawl: JavaScript SDK",
        type: "local", 
        source_id: fireCrawlSource.id,
        originalPath: "./knowledge/docs/firecrawl-js.md",
        url: "https://firecrawl.dev/docs/sdks/node",
        description: `Comprehensive guide to Firecrawl's Node.js SDK (@mendable/firecrawl-js) for web scraping, crawling, and structured data extraction. Details installation via npm and core functionality: FirecrawlApp initialization with API key, scrapeUrl for single pages, crawlUrl for multi-page crawling with pagination support, LLM extraction with Zod schema integration for structured data parsing. Covers advanced features: map endpoint for rapid site URL discovery with optional search filtering, extract endpoint for multi-URL structured data extraction via prompts or JSON schemas, page interaction via Actions API (click, scroll, input, wait), location/language specification for geotargeted content, batch scraping for parallel URL processing, search capability for SERP results with optional full-content retrieval. Includes complete TypeScript examples, response structure documentation, and asynchronous/synchronous implementation options. *Keywords: Firecrawl SDK, Node.js, JavaScript, TypeScript, Web Scraping, Web Crawling, Structured Data Extraction, @mendable/firecrawl-js, API Integration, FirecrawlApp, ScrapeParams, CrawlParams, scrapeUrl, crawlUrl, LLM Extraction, JSON Schema, Zod Schema, Semantic Search, URL Discovery, map Endpoint, extract Endpoint, Batch Processing, Actions API, Browser Automation, Geotargeting, Language Specification, Asynchronous Programming, SERP Results, Response Structure, Error Handling, Content Parsing, Full-Text Search, TypeScript Types, ScrapeResponse, CrawlResponse, Promise Handling.*`
      },
      // Document for FireCrawl Source - Firecrawl Scrape
      {
        name: "FireCrawl: Scrape API",
        type: "local", 
        source_id: fireCrawlSource.id,
        originalPath: "./knowledge/docs/firecrawl-scrape.md",
        url: "https://firecrawl.dev/docs/scrape",
        description: `This comprehensive guide details Firecrawl's /scrape endpoint for converting web pages into clean, structured data. It outlines core functionality: transforming any URL into markdown (optimal for LLMs), HTML, raw HTML, screenshots, links, or structured data. Features include: transparent handling of proxies, caching, rate limits; processing of dynamic JavaScript-rendered content; support for PDFs and images. Documents multiple output formats, structured data extraction via JSON schema or prompts, browser automation capabilities through Actions API (click, scroll, write, wait, press), geolocation/language customization, and batch processing for multiple URLs. Includes SDK examples for Python, Node.js, Go, Rust, and cURL with detailed response structure explanation. Covers advanced implementation patterns for handling interactions, error states, and combining with other endpoints. *Keywords: Firecrawl API, /scrape Endpoint, Web Scraping, LLM-Ready Data, Markdown Conversion, HTML Extraction, Screenshot Capture, Dynamic Content, JavaScript Rendering, Structured Data, JSON Schema, Prompt-based Extraction, Browser Automation, Click Actions, Scroll Actions, Form Input, Wait Operations, Keyboard Events, Geotargeting, Language Customization, Batch Processing, SDK Integration, Python SDK, Node.js SDK, Go SDK, Rust SDK, cURL Implementation, Response Handling, Metadata Extraction, Error Management, Content Parsing, Multi-URL Processing, Proxy Management, Rate Limiting, PDF Processing, Image Processing, API Authentication, Content Formats, Format Selection, Screenshot Options, Extract Options.*`
      },
      // New Document for AI Devs Source - WebSearch Example
      {
        name: "AI Devs: Web Search Example Code",
        type: "local",
        source_id: aiDevsSource.id,
        originalPath: "./knowledge/aidevs/ai_devs_websearch_example.md",
        url: null,
        description: `This file provides a complete TypeScript example demonstrating a web search agent implementation. It includes the \`WebSearchService\` class utilizing \`OpenAIService\` and \`@mendable/firecrawl-js\` for scraping. The example covers determining search necessity (\`isWebSearchNeeded\`), generating search queries for allowed domains (\`generateQueries\`), performing searches via the Firecrawl API (\`searchWeb\`), scoring SERP results based on relevance to the original query (\`scoreResults\`), selecting the best resources to load (\`selectResourcesToLoad\`), and scraping content from selected URLs (\`scrapeUrls\`). It defines prompts (\`useSearchPrompt\`, \`askDomainsPrompt\`, \`scoreResultsPrompt\`, \`selectResourcesToLoadPrompt\`, \`answerPrompt\`, \`extractKeywordsPrompt\`) for interacting with OpenAI models (GPT-4o, GPT-4o-mini). The example also sets up an Express server with a \`/api/chat\` endpoint to handle user messages and orchestrate the search and response generation workflow. Includes types like \`SearchNecessityResponse\`, \`Message\`, \`SearchResult\`, and a list of \`allowedDomains\`. *Keywords: Web Search Agent, TypeScript, OpenAI Service, FirecrawlApp, @mendable/firecrawl-js, ScrapeResponse, OpenAI.Chat.Completions.ChatCompletion, ChatCompletionMessageParam, Search Necessity, Query Generation, askDomainsPrompt, useSearchPrompt, SERP Scoring, scoreResultsPrompt, Resource Selection, selectResourcesToLoadPrompt, URL Scraping, scrapeUrls, Express.js, API Endpoint, GPT-4o, GPT-4o-mini, Allowed Domains, Prompts, answerPrompt, extractKeywordsPrompt, Firecrawl API, /v0/search, /v1/scrape, Site Query, Fetch API, JSON Parsing, Error Handling, Asynchronous Programming, Promises, Environment Variables, FIRECRAWL_API_KEY, Full-Text Search.*`
      },
      // New Document for AI Devs Source - LLM Interaction
      {
        name: "AI Devs: LLM Interaction Concepts",
        type: "local",
        source_id: aiDevsSource.id,
        originalPath: "./knowledge/aidevs/ai_devs_llm_interaction.md",
        url: null,
        description: `This document delves into the practical aspects of integrating Large Language Models (LLMs) into application logic, focusing on building AI Agents. It discusses various LLM providers (OpenAI, Anthropic, Vertex AI/Google Gemini, xAI Grok, Amazon Bedrock, Azure, Groq, OpenRouter, Perplexity, Cerebras, Databricks, Mistral AI, Together AI) and the cost/token implications of complex agent interactions (e.g., Linear task management example). It contrasts manual task management with rule-based automation and LLM-powered automation capable of handling diverse inputs (text, images, audio) from various sources, including other agents. Key agent steps (Understanding, Planning, Action, Response) are outlined. It introduces advanced interaction patterns like conversation summarization (using the \`thread\` example) to manage context windows, optimize costs, and improve focus, noting its impact on GPT-4o performance and potential use with Open Source models or for anonymization. Different interaction types (decision making, classification, parsing, transformation, evaluation) are explored using PromptFoo examples (\`use_search\`, \`pick_domains\`, \`rate\`), demonstrating techniques like Few-Shot learning and Chain-of-Thought prompting. The document emphasizes application architecture considerations (databases like PostgreSQL, search engines like Qdrant, state management, API design, prompt evaluation with PromptFoo, versioning, permissions, monitoring with LangFuse, asynchronous processing, UI). It introduces Retrieval-Augmented Generation (RAG) concepts using the \`websearch\` example with FireCrawl, Self-Querying, Re-ranking, and discusses challenges with data quality, context loss, and the importance of prompt design for memory (e.g., nickname example). The concept of Many-Shot In-Context Learning and prompt caching is mentioned for effectiveness optimization. *Keywords: LLM Interaction, AI Agents, API Integration, OpenAI, Anthropic Claude, Google Vertex AI Gemini, xAI Grok, Amazon Bedrock, Azure OpenAI, Groq, Open Source LLMs, Token Costs, Agentic Workflow, Conversation Summarization, Context Window Management, ChatML, Cost Optimization, Performance Optimization, Data Anonymization, Prompt Engineering, PromptFoo, Few-Shot Prompting, Chain of Thought, Thought Generation, Decision Making, Classification, Parsing, Transformation, Evaluation, Application Architecture, PostgreSQL, Qdrant, Vector Database, State Management, API Design, LangFuse, Asynchronous Processing, Retrieval-Augmented Generation, RAG, FireCrawl, Self-Querying, Re-rank, Data Quality, Long-Term Memory, Many-Shot In-Context Learning, Prompt Caching, Linear, Todoist, ClickUp.*`
      },
      // THIS RESOURCE IS REMOVED, BECAUSE WEB SEARCH REUIRES FIRECRAWL API KEY
      // {
      //   name: "Firecrawl Documentation (Online)",
      //   type: "external",
      //   source_id: fireCrawlSource.id,
      //   originalPath: "https://docs.firecrawl.dev",
      //   url: "https://docs.firecrawl.dev",
      //   description: `Firecrawl Documentation offers up to date documentation for the Firecrawl web scraping and crawling tool. Features: Scrape, Crawl, Map, Extract (New), Alpha Features, LLMs.txt, API, Deep Research, API Integrations, Langchain, Llamaindex, CrewAI, Dify, Flowise, Langflow, Camel AI, SourceSync.ai`
      // }
    ];

    const documentResults = [];
    const DOCUMENTS_ROOT = path.resolve(process.cwd(), "documents");
    
    // Make sure documents directory exists
    try {
      await fs.mkdir(DOCUMENTS_ROOT, { recursive: true });
      console.log(`✅ Ensured documents root directory exists at: ${DOCUMENTS_ROOT}`);
    } catch (error) {
      console.error("Failed to create documents directory:", error);
      throw error;
    }
    
    // Upload documents directly
    for (const doc of documentsToSeed) {
      try {
        console.log(`Processing document: ${doc.name} (Type: ${doc.type})`);

        const docUuid = uuidv4();
        let relativePath: string | null = null;

        if (doc.type === "local") {
          // --- Handle Local Document ---
          console.log(`  Type: local. Reading and saving file...`);
          // Read the markdown file content
          const content = await fs.readFile(path.resolve(process.cwd(), doc.originalPath), 'utf8');
          console.log(`  ✅ Read content from ${doc.originalPath}`);

          // Generate paths
          const paths = generateDocumentPaths(docUuid, path.basename(doc.originalPath));
          relativePath = paths.relativePath; // Assign relative path for local files
          const fullDirPath = paths.fullDirPath;

          // Create directory for the document
          await fs.mkdir(fullDirPath, { recursive: true });
          console.log(`  ✅ Created directory: ${fullDirPath}`);

          // Write file to the documents directory
          const fullPath = path.resolve(DOCUMENTS_ROOT, relativePath);
          await fs.writeFile(fullPath, content, 'utf8');
          console.log(`  ✅ Saved file to: ${fullPath}`);

        } else if (doc.type === "external") {
          // --- Handle External Document ---
          console.log(`  Type: external. Skipping file system operations.`);
          // Path remains null for external documents
        } else {
          // Handle other types if necessary, or throw error
          console.warn(`  ⚠️ Unknown document type: ${doc.type}. Skipping file system operations.`);
          // Path remains null
        }

        // Insert document record into database
        const [record] = await db.insert(documents).values({
          uuid: docUuid,
          name: doc.name,
          type: doc.type,
          source_id: doc.source_id,
          path: relativePath, // Will be null for external types
          url: doc.url,
          description: doc.description
        }).returning();

        console.log(`✅ Created database record for document: ${doc.name} (UUID: ${docUuid}, Path: ${relativePath || 'N/A'})`);
        documentResults.push(record);
      } catch (error) {
        console.error(`❌ Failed to process document ${doc.name}:`, error);
      }
    }

    console.log(`✅ Successfully seeded ${documentResults.length} documents:`);
    for (const doc of documentResults) {
      const sourceName = sourceResults.find(s => s.id === doc.source_id)?.name || 'Unknown Source';
      console.log(`- ${doc.name} (ID: ${doc.id}, Source: ${sourceName}): ${doc.path || doc.url}`);
    }
  } else {
    console.log("⚠️ Could not find required sources. Skipping document seeding.");
    if (!aiDevsSource) console.error("Error: AI Devs source not found after seeding.");
    if (!openAiSource) console.error("Error: OpenAI source not found after seeding.");
  }
  // --- End Seed Documents ---

  process.exit(0);
};

main().catch((e) => {
  console.error("❌ Error seeding database:", e);
  process.exit(1);
});
