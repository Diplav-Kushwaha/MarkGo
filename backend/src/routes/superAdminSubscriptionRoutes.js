import { Router } from "express";
import {
  listPlans,
  createPlan,
  updatePlan,
  setCompanyStatus,
  listSubscriptions,
  getSubscriptionSummary,
  createCompany,
  assignSubscription,
  deletePendingCompany,
} from "../controllers/superAdminSubscriptionController.js";
import { authenticateToken, requireSuperAdmin } from "../middleware/authMiddleware.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate, validateQuery } from "../middleware/validate.js";
import {
  planIdParamSchema,
  companyIdParamSchema,
  createPlanSchema,
  updatePlanSchema,
  companyStatusSchema,
  listSubscriptionsQuerySchema,
  superAdminCreateCompanySchema,
  assignSubscriptionSchema,
} from "../validators/superAdminSubscriptionValidators.js";

const router = Router();

// Every route requires an authenticated SUPERADMIN, matching the existing
// Super Admin router. Nothing here filters by company: these are platform-wide.
router.use(authenticateToken, requireSuperAdmin);

router.get("/plans", listPlans);
router.post("/plans", verifyCsrfToken, validate(createPlanSchema), createPlan);
router.patch("/plans/:id", verifyCsrfToken, validate(planIdParamSchema), validate(updatePlanSchema), updatePlan);

router.patch(
  "/companies/:id/status",
  verifyCsrfToken,
  validate(companyIdParamSchema),
  validate(companyStatusSchema),
  setCompanyStatus
);

// Company management. The other Super Admin router only declares
// GET /companies and GET /companies/:id, so none of these collide on method
// plus path, and this router falls through for anything it does not match.
router.post(
  "/companies",
  verifyCsrfToken,
  validate(superAdminCreateCompanySchema),
  createCompany
);
router.post(
  "/companies/:id/subscription",
  verifyCsrfToken,
  validate(companyIdParamSchema),
  validate(assignSubscriptionSchema),
  assignSubscription
);
router.delete(
  "/companies/:id/pending",
  verifyCsrfToken,
  validate(companyIdParamSchema),
  deletePendingCompany
);

// Declared before any parametrised subscription route would be, so it is never
// swallowed. There is deliberately no /subscriptions/:id in this router.
router.get("/subscriptions/summary", getSubscriptionSummary);
router.get("/subscriptions", validateQuery(listSubscriptionsQuerySchema), listSubscriptions);

export default router;