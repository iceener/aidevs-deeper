import { serve } from "@hono/node-server";
import app from "./app";

// Server configuration
const port = 3000;
// Start server
serve({ fetch: app.fetch, port, },
  (info) => { console.log(`Server is running on http://localhost:${info.port}`); 
});