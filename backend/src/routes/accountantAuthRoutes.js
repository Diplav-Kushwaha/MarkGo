import { Router } from "express";
import {
  verifyInvite,
  acceptInvite,
  loginAccountant,
  refreshAccountantTokens,
  logoutAccountant,
  getAccountantProfile,
} from "../controllers/accountantAuthController.js";
import { authenticateAccountantToken } from "../middleware/accountantAuthMiddleware.js";
import { loginLimiter, refreshLimiter } from "../middleware/rateLimiter.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import {
  acceptAccountantInviteSchema,
  accountantLoginSchema,
} from "../validators/accountantAuthSchemas.js";

const router = Router();

router.get("/verify-invite", verifyInvite);
router.post("/accept-invite", verifyCsrfToken, validate(acceptAccountantInviteSchema), acceptInvite);
router.post("/login", loginLimiter, verifyCsrfToken, validate(accountantLoginSchema), loginAccountant);
router.post("/refresh", refreshLimiter, verifyCsrfToken, refreshAccountantTokens);
router.post("/logout", verifyCsrfToken, logoutAccountant);
router.get("/me", authenticateAccountantToken, getAccountantProfile);

export default router;
