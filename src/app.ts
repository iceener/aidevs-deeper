import { Hono } from "hono";
import router from "./routes";
import { globalErrorHandler } from "./middleware/errorHandler";

const app = new Hono();

app.route("/", router);
// Note: This MUST come after route registration
app.onError(globalErrorHandler);

export default app; 