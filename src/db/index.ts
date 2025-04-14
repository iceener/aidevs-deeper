import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema'; 

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL environment variable is not set or .env/.env.local is missing.");
}

console.log(`Attempting to connect to database: ${dbUrl}`);

const client = createClient({
    url: dbUrl,
    // authToken: process.env.DATABASE_AUTH_TOKEN, // Add if connecting to Turso
});

export const db = drizzle(client, { schema, logger: process.env.NODE_ENV !== 'production' });

console.log(`Database service initialized for: ${dbUrl}`); 