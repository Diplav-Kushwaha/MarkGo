import { Router } from "express";
import {
  verifyInvite,
  acceptInvite,
  loginVendor,
  refreshVendorTokens,
  logoutVendor,
  getVendorProfile,
} from "../controllers/vendorAuthController.js";
import { authenticateVendorToken } from "../middleware/vendorAuthMiddleware.js";
import { loginLimiter, refreshLimiter } from "../middleware/rateLimiter.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { acceptVendorInviteSchema, vendorLoginSchema } from "../validators/vendorAuthSchemas.js";

const router = Router();

router.get("/verify-invite", verifyInvite);
router.post("/accept-invite", verifyCsrfToken, validate(acceptVendorInviteSchema), acceptInvite);
router.post("/login", loginLimiter, verifyCsrfToken, validate(vendorLoginSchema), loginVendor);
router.post("/refresh", refreshLimiter, verifyCsrfToken, refreshVendorTokens);
router.post("/logout", verifyCsrfToken, logoutVendor);
router.get("/me", authenticateVendorToken, getVendorProfile);

export default router;
