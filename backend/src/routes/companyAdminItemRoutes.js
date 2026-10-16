import { Router } from "express";
import {
  createItem,
  getItems,
  getItemStats,
  exportItems,
  getItemById,
  updateItem,
  updateItemStatus,
  deleteItem,
  bulkActionItems,
  getProductSummary,
} from "../controllers/companyAdminItemController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate, validateQuery } from "../middleware/validate.js";
import {
  updateItemStatusSchema,
  bulkActionItemSchema,
} from "../validators/itemSchemas.js";
import {
  createProductSchema,
  updateProductSchema,
  productListQuerySchema,
} from "../validators/productSchemas.js";
import {
  createServiceSchema,
  updateServiceSchema,
  serviceListQuerySchema,
} from "../validators/serviceSchemas.js";

const router = Router();

// Every item route requires an authenticated Company Admin.
router.use(authenticateToken, requireCompanyAdmin, requireActiveSubscription);

// ---------------------------------------------------------------------------
// Products and Services share these routes.
//
// A request that explicitly declares `type: "PRODUCT"` is validated and handled
// by the product rules; anything else — services, and requests that declare no
// type at all — is validated and handled by the new service rules
// (serviceSchemas.js / serviceService.js), which only ever read and write
// SERVICE rows.
//
// The declaration is read from the RAW request, before validation runs: the
// item schema injects `type: "PRODUCT"` as its default, so the validated body
// cannot be used to decide the routing or every update would look like a
// product update. It is published on `req.declaredItemType` for the controller.
//
// The item schema itself is kept for what it has always been used for on this
// router: the status contract (ACTIVE / INACTIVE) and the bulk-action body.
// ---------------------------------------------------------------------------

function declaredType(source) {
  const declared = source?.type;
  if (declared === undefined || declared === null || String(declared).trim() === "") return null;
  return String(declared).trim().toUpperCase();
}

/** Picks the product schema or the service schema from the declared type. */
function validateBody(productSchema, serviceSchema) {
  return (req, res, next) => {
    req.declaredItemType = declaredType(req.body);
    const schema = req.declaredItemType === "PRODUCT" ? productSchema : serviceSchema;
    return validate(schema)(req, res, next);
  };
}

/**
 * Same idea for a list query: products get the product query schema, everything
 * else gets the service query schema (which drops the filters services do not
 * have, such as `type`, `stock` and `category`).
 */
function validateListQuery(productSchema, serviceSchema) {
  return (req, res, next) => {
    if (declaredType(req.query) === "PRODUCT") {
      return validateQuery(productSchema)(req, res, next);
    }
    return validateQuery(serviceSchema)(req, res, next);
  };
}

// Static paths first, so they are never captured by `/:id`.
router.get("/stats", getItemStats);
router.get("/export", exportItems);
// Company-wide product totals. Not affected by any list filter.
router.get("/summary", getProductSummary);
router.post("/bulk", verifyCsrfToken, validate(bulkActionItemSchema), bulkActionItems);

router.post("/", verifyCsrfToken, validateBody(createProductSchema, createServiceSchema), createItem);
router.get("/", validateListQuery(productListQuerySchema, serviceListQuerySchema), getItems);
router.get("/:id", getItemById);
router.patch("/:id", verifyCsrfToken, validateBody(updateProductSchema, updateServiceSchema), updateItem);
// Services and products share one status contract (ACTIVE / INACTIVE), so this
// route keeps validating with the item schema. The product service applies its
// own "no stock cannot be Available" rule on top of it; services have no such
// rule.
router.patch("/:id/status", verifyCsrfToken, validate(updateItemStatusSchema), updateItemStatus);
router.delete("/:id", verifyCsrfToken, deleteItem);

export default router;
