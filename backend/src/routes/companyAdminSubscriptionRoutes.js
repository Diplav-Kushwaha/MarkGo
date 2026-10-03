import { Router } from "express";
import {
  getMySubscription,
  getMyHistory,
  purchasePlan,
  startFree,
} from "../controllers/companySubscriptionController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate, validateQuery } from "../middleware/validate.js";
import {
  purchasePlanSchema,
  startFreeSchema,
  subscriptionHistoryQuerySchema,
} from "../validators/subscriptionSchemas.js";

/**
 * IMPORTANT: these routes must stay reachable when a company's plan is expired,
 * suspended or missing entirely. That is the whole point — a company in that
 * state still has to be able to view its subscription, buy a plan or move to
 * Free. Do NOT wrap this router in any subscription/expiry check; enforcement
 * belongs on the other company-admin routes and is gated by
 * ENFORCE_SUBSCRIPTION in a later step.
 *
 * The company is taken from the logged-in user, never from the request.
 */
const router = Router();

// Every route requires an authenticated Company Admin.
router.use(authenticateToken, requireCompanyAdmin);

router.get("/", getMySubscription);
router.get("/history", validateQuery(subscriptionHistoryQuerySchema), getMyHistory);
router.post("/purchase", verifyCsrfToken, validate(purchasePlanSchema), purchasePlan);
router.post("/start-free", verifyCsrfToken, validate(startFreeSchema), startFree);

export default router;