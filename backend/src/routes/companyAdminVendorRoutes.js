import { Router } from "express";
import {
  createVendor,
  getVendors,
  getVendorStats,
  exportVendors,
  getVendorById,
  updateVendor,
  updateVendorStatus,
  inviteVendor,
  deleteVendor,
  bulkActionVendors,
} from "../controllers/companyAdminVendorController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import {
  createVendorSchema,
  updateVendorSchema,
  updateVendorStatusSchema,
  bulkActionVendorSchema,
} from "../validators/vendorSchemas.js";

const router = Router();

// Every vendor route requires a logged-in Company Admin.
router.use(authenticateToken, requireCompanyAdmin, requireActiveSubscription);

router.get("/stats", getVendorStats);
router.get("/export", exportVendors);
router.post("/bulk", verifyCsrfToken, validate(bulkActionVendorSchema), bulkActionVendors);

router.post("/", verifyCsrfToken, validate(createVendorSchema), createVendor);
router.get("/", getVendors);
router.get("/:id", getVendorById);
router.patch("/:id", verifyCsrfToken, validate(updateVendorSchema), updateVendor);
router.patch(
  "/:id/status",
  verifyCsrfToken,
  validate(updateVendorStatusSchema),
  updateVendorStatus
);
router.post("/:id/invite", verifyCsrfToken, inviteVendor);
router.delete("/:id", verifyCsrfToken, deleteVendor);

export default router;
