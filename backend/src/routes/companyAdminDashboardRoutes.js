import { Router } from "express";
import { getDashboard, getDashboardSummary, getDashboardCharts } from "../controllers/dashboardController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
import { validateQuery } from "../middleware/validate.js";
import {
  dashboardSummaryQuerySchema,
  dashboardChartsQuerySchema,
} from "../validators/dashboardValidators.js";

/**
 * Company Admin dashboard.
 *
 * STRICTLY READ-ONLY: every route below is a GET, and `authenticateToken` +
 * `requireCompanyAdmin` run for all of them, so the company is always taken
 * from the verified token and a customer, vendor or super admin gets a 403.
 *
 * Route order: the static `/summary` and `/charts` segments are registered
 * before the bare `/`, and there is no `/:id` on this router, so a named path
 * can never be shadowed (each matches a different, fixed segment).
 */
const router = Router();

router.use(authenticateToken, requireCompanyAdmin, requireActiveSubscription);

router.get("/summary", validateQuery(dashboardSummaryQuerySchema), getDashboardSummary);
router.get("/charts", validateQuery(dashboardChartsQuerySchema), getDashboardCharts);
router.get("/", getDashboard);

export default router;
