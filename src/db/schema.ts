import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
};

// --- Threads ---

export const threads = sqliteTable("threads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uuid: text("uuid")
    .notNull()
    .unique()
    .$defaultFn(() => uuidv4()),
  name: text("name"),
  ...timestamps, 
});

// Relation: A thread can have many messages and many tasks
export const threadsRelations = relations(threads, ({ many }) => ({
  messages: many(messages),
  tasks: many(tasks),
}));

// --- Messages ---

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uuid: text("uuid")
    .notNull()
    .unique()
    .$defaultFn(() => uuidv4()),
  threadId: integer("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: 'cascade' }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  ...timestamps,
});

// Relation: A message belongs to one thread
export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
}));

// --- Sources ---

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uuid: text("uuid").notNull().unique().$defaultFn(() => uuidv4()),
  name: text("name").notNull(),
  type: text("type", { enum: ["website", "file", "manual"] }).notNull(),
  origin: text("origin").notNull(),
  description: text("description"),
  scraped_at: text("scraped_at"),
  structure: text("structure"),
  ...timestamps,
}, (table) => ([
  uniqueIndex("sources_uuid_idx").on(table.uuid),
]));

// Relation: A source can have many documents, many notes, and be referenced by many tasks.
export const sourcesRelations = relations(sources, ({ many }) => ({
  documents: many(documents),
  notes: many(notes),
  tasksToSources: many(tasks_to_sources), // Many-to-many link to tasks referencing this source
}));

// --- Tasks ---

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uuid: text("uuid").notNull().unique().$defaultFn(() => uuidv4()),
  thread_id: integer("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
  query_message_id: integer("query_message_id")
      .references(() => messages.id, { onDelete: 'set null' }),
  name: text("name"),
  description: text("description"),
  context: text("context"),
  outline: text("outline"),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull().default("pending"),
  ...timestamps,
}, (table) => ([
  uniqueIndex("tasks_uuid_idx").on(table.uuid),
  index("tasks_thread_idx").on(table.thread_id),
  index("tasks_query_message_idx").on(table.query_message_id),
]));

// Relation: A task belongs to one thread, optionally triggered by one message,
// can reference many documents/sources, produce many results, and have many notes.
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  thread: one(threads, {
    fields: [tasks.thread_id],
    references: [threads.id],
  }),
  queryMessage: one(messages, {
    fields: [tasks.query_message_id],
    references: [messages.id],
  }),
  results: many(results),
  notes: many(notes),
  tasksToDocuments: many(tasks_to_documents),
  tasksToSources: many(tasks_to_sources),
  steps: many(steps), // Added relation to steps
}));

// --- Documents ---

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uuid: text("uuid").notNull().unique().$defaultFn(() => uuidv4()),
  type: text("type", { enum: ["local", "external", "generated"] }).notNull(),
  source_id: integer("source_id")
      .references(() => sources.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  path: text("path"),
  url: text("url"),
  ...timestamps,
}, (table) => ([
  uniqueIndex("documents_uuid_idx").on(table.uuid),
  index("documents_type_idx").on(table.type),
  index("documents_source_idx").on(table.source_id),
]));

// Relation: A document belongs to one source, can be referenced by many tasks (via junction),
// can be part of many results, and can have many notes.
export const documentsRelations = relations(documents, ({ one, many }) => ({
  source: one(sources, {
    fields: [documents.source_id],
    references: [sources.id],
  }),
  notes: many(notes),
  results: many(results), // Link to results where this document is the output
  tasksToDocuments: many(tasks_to_documents), // Many-to-many link to tasks referencing this document
}));

// --- Notes ---
// Define notes last as it references tasks and documents

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uuid: text("uuid").notNull().unique().$defaultFn(() => uuidv4()),
  task_id: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
  source_id: integer("source_id")
      .references(() => sources.id, { onDelete: 'cascade' }),
  document_id: integer("document_id")
      .references(() => documents.id, { onDelete: 'cascade' }),
  query: text("query"),
  content: text("content").notNull(),
  ...timestamps,
}, (table) => ([
  uniqueIndex("notes_uuid_idx").on(table.uuid),
  index("notes_task_idx").on(table.task_id),
  index("notes_source_idx").on(table.source_id),
  index("notes_document_idx").on(table.document_id),
]));

// Relation: A note belongs to one task, and optionally one source and/or one document
export const notesRelations = relations(notes, ({ one }) => ({
  task: one(tasks, {
    fields: [notes.task_id],
    references: [tasks.id],
  }),
  source: one(sources, {
    fields: [notes.source_id],
    references: [sources.id],
  }),
  document: one(documents, {
    fields: [notes.document_id],
    references: [documents.id],
  }),
}));

// --- Results (New Table) ---
// Links a completed task to its output document(s)

export const results = sqliteTable("results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uuid: text("uuid").notNull().unique().$defaultFn(() => uuidv4()),
  task_id: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
  document_id: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }), // Assuming result deletion cascades to the doc? Maybe set null?
  ...timestamps,
}, (table) => ([
  uniqueIndex("results_uuid_idx").on(table.uuid),
  index("results_task_idx").on(table.task_id),
  index("results_document_idx").on(table.document_id),
  // Optional: uniqueConstraint("results_task_doc_unique").on(table.task_id, table.document_id)
]));

// Relation: A result belongs to one task and one document
export const resultsRelations = relations(results, ({ one }) => ({
  task: one(tasks, {
    fields: [results.task_id],
    references: [tasks.id],
  }),
  document: one(documents, {
    fields: [results.document_id],
    references: [documents.id],
  }),
}));

// --- Tasks to Documents (New Junction Table) ---
// Many-to-many relationship between tasks and referenced documents

export const tasks_to_documents = sqliteTable("tasks_to_documents", {
  task_id: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
  document_id: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
  // No timestamps needed here unless tracking when the association was made
}, (table) => ({
  // Define composite primary key
  pk: primaryKey({ columns: [table.task_id, table.document_id] }),
  // Indexes for faster lookups if needed
  task_idx: index("tasks_docs_task_idx").on(table.task_id),
  doc_idx: index("tasks_docs_doc_idx").on(table.document_id),
}));

// Relation: Links Task and Document for many-to-many
export const tasksToDocumentsRelations = relations(tasks_to_documents, ({ one }) => ({
  task: one(tasks, {
    fields: [tasks_to_documents.task_id],
    references: [tasks.id],
  }),
  document: one(documents, {
    fields: [tasks_to_documents.document_id],
    references: [documents.id],
  }),
}));

// --- Tasks to Sources (New Junction Table) ---
// Many-to-many relationship between tasks and referenced sources

export const tasks_to_sources = sqliteTable("tasks_to_sources", {
  task_id: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
  source_id: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.task_id, table.source_id] }),
  task_idx: index("tasks_sources_task_idx").on(table.task_id),
  source_idx: index("tasks_sources_source_idx").on(table.source_id),
}));

// Relation: Links Task and Source for many-to-many
export const tasksToSourcesRelations = relations(tasks_to_sources, ({ one }) => ({
  task: one(tasks, {
    fields: [tasks_to_sources.task_id],
    references: [tasks.id],
  }),
  source: one(sources, {
    fields: [tasks_to_sources.source_id],
    references: [sources.id],
  }),
}));

// --- Steps (New Table) ---
// Represents an individual step or action within a task execution

export const steps = sqliteTable("steps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  uuid: text("uuid").notNull().unique().$defaultFn(() => uuidv4()),
  task_id: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }), // Link step to its parent task
  name: text("name"), // Optional name for the step
  tool: text("tool"), // Optional tool used for the step
  request: text("request"), // Optional field for step input/parameters (e.g., JSON string)
  results: text("results"), // Optional field for step output/outcome (e.g., JSON string)
  ...timestamps,
}, (table) => ([
  uniqueIndex("steps_uuid_idx").on(table.uuid),
  index("steps_task_idx").on(table.task_id),
]));

// Relation: A step belongs to one task
export const stepsRelations = relations(steps, ({ one }) => ({
  task: one(tasks, {
    fields: [steps.task_id],
    references: [tasks.id],
  }),
}));
