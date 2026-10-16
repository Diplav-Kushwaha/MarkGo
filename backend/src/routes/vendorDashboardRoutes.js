import { Router } from "express";
import {
  getProfile,
  getSoldProducts,
  getBills,
  getBillById,
  getProducts,
  getServices,
} from "../controllers/vendorDashboardController.js";
import { authenticateVendorToken } from "../middleware/vendorAuthMiddleware.js";
import { validateQuery, validateParams } from "../middleware/validate.js";
import {
  soldProductsQuerySchema,
  vendorBillsQuerySchema,
  vendorBillIdParamSchema,
  vendorCatalogQuerySchema,
} from "../validators/vendorDashboardValidators.js";

/**
 * Vendor dashboard routes — strictly READ-ONLY and vendor-only.
 *
 * Every route below is GET. `authenticateVendorToken` runs first for all of
 * them: it verifies the vendor access token and rejects anything whose token
 * is not a VENDOR token (an admin or customer token fails its role check with a
 * 401), so no other role can reach this router. There are no POST/PUT/PATCH/
 * DELETE routes here, so a vendor cannot create, edit, delete or trigger any
 * action through this router.
 *
 * Mounted after vendorAuthRoutes in index.js, so that router's /login,
 * /refresh, /logout, /me and /verify-invite keep resolving first; none of the
 * paths below overlap them.
 */
const router = Router();

router.use(authenticateVendorToken);

// Static paths first, so "/bills" is never captured by "/bills/:id".
router.get("/profile", getProfile);
router.get("/sold-products", validateQuery(soldProductsQuerySchema), getSoldProducts);
router.get("/bills", validateQuery(vendorBillsQuerySchema), getBills);
router.get("/bills/:id", validateParams(vendorBillIdParamSchema), getBillById);
router.get("/products", validateQuery(vendorCatalogQuerySchema), getProducts);
router.get("/services", validateQuery(vendorCatalogQuerySchema), getServices);

export default router;
