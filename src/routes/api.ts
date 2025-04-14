import { Hono } from "hono";
import { chatHandler } from "../handlers/chat";
import { serveDocument, createDocument } from "../handlers/files";
import { apiKeyAuth } from "../middleware/auth";
import { validateChatRequest } from "../middleware/chatValidation";

const api = new Hono();

api.get("/files/:id", serveDocument);

api.use('*', apiKeyAuth);

api.post("/chat", validateChatRequest, chatHandler);
api.post("/documents", createDocument);

export default api;