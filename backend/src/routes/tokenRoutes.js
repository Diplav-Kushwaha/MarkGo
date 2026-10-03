import { Router } from "express";
import { refreshTokens } from "../controllers/tokenController.js";
import { refreshLimiter } from "../middleware/rateLimiter.js";
import { verifyCsrfToken } from "../middleware/csrf.js";

// POST /api/auth/refresh — rotates the refresh token and issues a new short-lived access token.

const router = Router();
router.post("/refresh", refreshLimiter, verifyCsrfToken, refreshTokens);
export default router;
