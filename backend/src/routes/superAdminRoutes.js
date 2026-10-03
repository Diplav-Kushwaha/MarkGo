import { Router } from "express";
import {
  loginSuperAdmin,
  logoutSuperAdmin,
  getSuperAdminProfile,
} from "../controllers/superAdminAuthController.js";
import {
  listCompanies,
  getPlatformDashboard,
  getCompanyDetails,
} from "../controllers/superAdminController.js";
import { authenticateToken, requireSuperAdmin } from "../middleware/authMiddleware.js";
import { loginLimiter } from "../middleware/rateLimiter.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate, validateQuery } from "../middleware/validate.js";
import { loginSchema } from "../validators/authSchemas.js";
import { listSuperAdminCompaniesQuerySchema } from "../validators/superAdminValidators.js";

const router = Router();

router.post("/login", loginLimiter, verifyCsrfToken, validate(loginSchema), loginSuperAdmin);
router.post("/logout", verifyCsrfToken, logoutSuperAdmin);
router.get("/me", authenticateToken, requireSuperAdmin, getSuperAdminProfile);
router.get(
  "/dashboard",
  authenticateToken,
  requireSuperAdmin,
  getPlatformDashboard
);
router.get(
  "/companies",
  authenticateToken,
  requireSuperAdmin,
  validateQuery(listSuperAdminCompaniesQuerySchema),
  listCompanies
);
// Read-only details for one company. Declared after /companies so the list
// route is matched first.
router.get("/companies/:id", authenticateToken, requireSuperAdmin, getCompanyDetails);

export default router;
