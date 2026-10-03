import { Router } from "express";
import { issueCsrfToken } from "../middleware/csrf.js";

// GET /api/csrf-token — frontend calls this once (e.g. on app load) to get the token

const router = Router();
router.get("/csrf-token", issueCsrfToken);
export default router;
