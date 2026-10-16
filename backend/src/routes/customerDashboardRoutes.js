import { Router } from "express";
import {
  getProfile,
  getPurchasedProducts,
  getInvoices,
  getInvoiceById,
  getProducts,
  getServices,
} from "../controllers/customerDashboardController.js";
import { authenticateCustomerToken } from "../middleware/customerAuthMiddleware.js";
import { validateQuery, validateParams } from "../middleware/validate.js";
import {
  purchasedProductsQuerySchema,
  customerInvoicesQuerySchema,
  companyCatalogQuerySchema,
  customerInvoiceIdParamSchema,
} from "../validators/customerDashboardValidators.js";

/**
 * Customer dashboard routes — strictly READ-ONLY and customer-only.
 *
 * Every route below is GET. `authenticateCustomerToken` runs first for all of
 * them: it verifies the customer access token and rejects anything whose token
 * is not a CUSTOMER token (an admin or vendor token fails its role check with a
 * 401), so no other role can reach this router. There are no POST/PUT/PATCH/
 * DELETE routes here, so a customer cannot create, edit, delete or trigger any
 * action through this router.
 */
const router = Router();

router.use(authenticateCustomerToken);

router.get("/profile", getProfile);
router.get("/purchased-products", validateQuery(purchasedProductsQuerySchema), getPurchasedProducts);
router.get("/invoices", validateQuery(customerInvoicesQuerySchema), getInvoices);
router.get("/invoices/:id", validateParams(customerInvoiceIdParamSchema), getInvoiceById);
router.get("/products", validateQuery(companyCatalogQuerySchema), getProducts);
router.get("/services", validateQuery(companyCatalogQuerySchema), getServices);

export default router;
