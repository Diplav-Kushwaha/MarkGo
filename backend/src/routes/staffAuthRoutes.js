import { Router } from "express";
import {
  verifyInvite,
  acceptInvite,
  loginStaff,
  refreshStaffTokens,
  logoutStaff,
  getStaffProfile,
} from "../controllers/staffAuthController.js";
import { authenticateStaffToken } from "../middleware/staffAuthMiddleware.js";
import { loginLimiter, refreshLimiter } from "../middleware/rateLimiter.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { acceptStaffInviteSchema, staffLoginSchema } from "../validators/staffAuthSchemas.js";

const router = Router();

router.get("/verify-invite", verifyInvite);
router.post("/accept-invite", verifyCsrfToken, validate(acceptStaffInviteSchema), acceptInvite);
router.post("/login", loginLimiter, verifyCsrfToken, validate(staffLoginSchema), loginStaff);
router.post("/refresh", refreshLimiter, verifyCsrfToken, refreshStaffTokens);
router.post("/logout", verifyCsrfToken, logoutStaff);
router.get("/me", authenticateStaffToken, getStaffProfile);

export default router;
