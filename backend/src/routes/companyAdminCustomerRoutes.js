import { Router } from "express";
import {
  createCustomer,
  getCustomers,
  getCustomerStats,
  exportCustomers,
  getCustomerById,
  updateCustomer,
  updateCustomerStatus,
  inviteCustomer,
  deleteCustomer,
  bulkActionCustomers,
  lookupGstin,
} from "../controllers/companyAdminCustomerController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
  bulkActionCustomerSchema,
} from "../validators/customerSchemas.js";

const router = Router();

// Every customer route requires a logged-in Company Admin.
router.use(authenticateToken, requireCompanyAdmin);

router.get("/stats", getCustomerStats);
router.get("/export", exportCustomers);
router.get("/lookup-gstin", lookupGstin);
router.post("/bulk", verifyCsrfToken, validate(bulkActionCustomerSchema), bulkActionCustomers);

router.post("/", verifyCsrfToken, validate(createCustomerSchema), createCustomer);
router.get("/", getCustomers);
router.get("/:id", getCustomerById);
router.patch("/:id", verifyCsrfToken, validate(updateCustomerSchema), updateCustomer);
router.patch(
  "/:id/status",
  verifyCsrfToken,
  validate(updateCustomerStatusSchema),
  updateCustomerStatus
);
router.post("/:id/invite", verifyCsrfToken, inviteCustomer);
router.delete("/:id", verifyCsrfToken, deleteCustomer);

export default router;
