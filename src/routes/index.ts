import { Hono } from "hono";
import { home } from "../handlers/home";
import api from "./api";

const router = new Hono();

router.get("/", home);
router.route("/api", api);

export default router; 