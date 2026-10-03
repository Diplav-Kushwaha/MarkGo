import { Router } from "express";
import { listActivePlans } from "../controllers/planController.js";

const router = Router();

// Public read used by the plans page before registration. No authenticate
// middleware and no verifyCsrfToken, matching /register and /login which are
// also reachable without a session.
router.get("/", listActivePlans);

export default router;