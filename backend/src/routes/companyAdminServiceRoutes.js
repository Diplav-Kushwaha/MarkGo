import { Router } from "express";
import { getServiceSummary } from "../controllers/companyAdminServiceController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";

/**
 * Service-only routes that do not exist on the shared item paths.
 *
 * The service CRUD endpoints keep their existing paths under
 * `/api/admin/items` (see companyAdminItemRoutes.js, which dispatches on the
 * declared `type`). This router only carries the endpoints the item router has
 * no place for.
 */
const router = Router();

// Every service route requires an authenticated Company Admin.
router.use(authenticateToken, requireCompanyAdmin, requireActiveSubscription);

// Company-wide service totals. Not affected by any list filter.
router.get("/summary", getServiceSummary);

export default router;
