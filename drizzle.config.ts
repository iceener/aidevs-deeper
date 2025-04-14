import { defineConfig } from "drizzle-kit";

// Bun automatically loads .env files
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL environment variable is not set or .env/.env.local is missing.");
}

export default defineConfig({
  dialect: "sqlite", // Specify 'sqlite' for LibSQL compatibility
  schema: "./src/db/schema.ts", // Path to your schema file
  out: "./drizzle", // Directory to output migration files
  // driver: 'libsql', // Not needed for file-based SQLite via @libsql/client
  dbCredentials: {
    url: dbUrl, // Use the loaded environment variable
  },
  verbose: false, // Optional: Enable verbose logging
  strict: true, // Optional: Enable strict mode for prompts
}); 