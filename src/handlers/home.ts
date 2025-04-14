import type { Context } from "hono";

export const home = (c: Context) => c.text("Down the rabbit hole!"); 