import { Router } from "express";
import {
  registerCompanyAdmin,
  loginCompanyAdmin,
  logoutCompanyAdmin,
  getCompanyAdminProfile,
} from "../controllers/companyAdminAuthController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { registerLimiter, loginLimiter } from "../middleware/rateLimiter.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../validators/authSchemas.js";

const router = Router();

router.post("/register", registerLimiter, verifyCsrfToken, validate(registerSchema), registerCompanyAdmin);
router.post("/login", loginLimiter, verifyCsrfToken, validate(loginSchema), loginCompanyAdmin);
router.post("/logout", verifyCsrfToken, logoutCompanyAdmin);
router.get("/me", authenticateToken, requireCompanyAdmin, getCompanyAdminProfile);

export default router;
