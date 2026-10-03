import { Router } from "express";
import {
  verifyInvite,
  acceptInvite,
  loginCustomer,
  refreshCustomerTokens,
  logoutCustomer,
  getCustomerProfile,
} from "../controllers/customerAuthController.js";
import { authenticateCustomerToken } from "../middleware/customerAuthMiddleware.js";
import { loginLimiter, refreshLimiter } from "../middleware/rateLimiter.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { acceptInviteSchema, customerLoginSchema } from "../validators/customerAuthSchemas.js";

const router = Router();

router.get("/verify-invite", verifyInvite);
router.post("/accept-invite", verifyCsrfToken, validate(acceptInviteSchema), acceptInvite);
router.post("/login", loginLimiter, verifyCsrfToken, validate(customerLoginSchema), loginCustomer);
router.post("/refresh", refreshLimiter, verifyCsrfToken, refreshCustomerTokens);
router.post("/logout", verifyCsrfToken, logoutCustomer);
router.get("/me", authenticateCustomerToken, getCustomerProfile);

export default router;
