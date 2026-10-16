import { Router } from "express";
import {
  getSalesReport,
  getSalesListReport,
  getOutstandingReport,
  getPurchasesReport,
  getTransactionsReport,
  getProfitLossReport,
  getSoldProductsReport,
  getSoldServicesReport,
  getSoldItemLines,
  getCustomersReport,
  getVendorsReport,
  getProductsReport,
  getServicesReport,
} from "../controllers/reportController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
import { validateQuery } from "../middleware/validate.js";
import {
  salesReportQuerySchema,
  salesListReportQuerySchema,
  purchasesReportQuerySchema,
  transactionsReportQuerySchema,
  profitLossReportQuerySchema,
  soldProductsReportQuerySchema,
  soldServicesReportQuerySchema,
  soldItemLinesQuerySchema,
  customersReportQuerySchema,
  vendorsReportQuerySchema,
  productsReportQuerySchema,
  servicesReportQuerySchema,
} from "../validators/reportValidators.js";

/**
 * Company admin reports.
 *
 * STRICTLY READ-ONLY. Every route on this router is a GET; there is no POST,
 * PUT, PATCH or DELETE anywhere on it, so no report page can create, edit or
 * delete anything. `authenticateToken` + `requireCompanyAdmin` run for all of
 * them, so a customer, a vendor and a super admin all get a 403 — and the
 * company every query is filtered by comes from the verified token, never from
 * a query parameter.
 *
 * Route order matters: the named routes below must be registered before any
 * `/:param` route so a named path can never be shadowed. The only parameterised
 * route is `/sold-items/lines`, whose `:itemId` sits under a fixed prefix and
 * cannot swallow another report path.
 */

const router = Router();

router.use(authenticateToken, requireCompanyAdmin, requireActiveSubscription);

// --- The two routes that were already here ---------------------------------
router.get("/sales", validateQuery(salesReportQuerySchema), getSalesReport);
router.get("/outstanding", getOutstandingReport);

// --- The ten new report endpoints ------------------------------------------
// 1. Sales
router.get("/sales-list", validateQuery(salesListReportQuerySchema), getSalesListReport);

// 2. Purchases
router.get("/purchases", validateQuery(purchasesReportQuerySchema), getPurchasesReport);

// 3. All transactions
router.get("/transactions", validateQuery(transactionsReportQuerySchema), getTransactionsReport);

// 4. Profit & loss
router.get("/profit-loss", validateQuery(profitLossReportQuerySchema), getProfitLossReport);

// 5. / 6. Item-wise profit & loss, and the sale lines behind the selector
router.get("/sold-products", validateQuery(soldProductsReportQuerySchema), getSoldProductsReport);
router.get("/sold-services", validateQuery(soldServicesReportQuerySchema), getSoldServicesReport);
// 5. / 6. Item-wise profit & loss.
//
// `/sold-items/lines` is a fixed prefix with no parameter in it, so it can never
// shadow (or be shadowed by) a named route — `express-router-mocks` and the
// real router both match on whole segments, and there is no `/:id` anywhere on
// this router. The item and its type travel as query parameters so that a single
// query validator covers them, and the service still confirms the item belongs
// to the caller's company before returning anything.
router.get(
  "/sold-items/lines",
  validateQuery(soldItemLinesQuerySchema),
  getSoldItemLines
);

// 7. / 8. Customers and vendors
router.get("/customers", validateQuery(customersReportQuerySchema), getCustomersReport);
router.get("/vendors", validateQuery(vendorsReportQuerySchema), getVendorsReport);

// 9. / 10. Products and services catalogue
router.get("/products", validateQuery(productsReportQuerySchema), getProductsReport);
router.get("/services", validateQuery(servicesReportQuerySchema), getServicesReport);

export default router;
