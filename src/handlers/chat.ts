import type { Context } from "hono";
import { processChatTurn } from "../services/agent/chat.service";
import { createOpenAIStreamFormatter } from "../utils/stream";
import { isAppError } from "../errors";
import type { StatusCode } from "hono/utils/http-status";

export const chatHandler = async (c: Context) => {
  try {
    const body = c.get("chat");

    const chatEvents = await processChatTurn(body);
    const streamFormatter = createOpenAIStreamFormatter();
    const stream = chatEvents.pipeThrough(streamFormatter);

    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    return c.body(stream);
  } catch (error) {
    console.error("Error in chatHandler:", error);
    if (isAppError(error)) {
      c.status(error.statusCode as StatusCode);
      return c.json({ error: error.type, message: error.message });
    }
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    c.status(500);
    return c.json({ error: "Internal Server Error", message });
  }
};
