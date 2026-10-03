import { Router } from "express";
import {
  createStaff,
  getStaff,
  getStaffById,
  updateStaff,
  updateStaffStatus,
  inviteStaff,
  deleteStaff,
} from "../controllers/companyAdminStaffController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import {
  createStaffSchema,
  updateStaffSchema,
  updateStaffStatusSchema,
} from "../validators/staffSchemas.js";

const router = Router();

// Every staff route requires a logged-in Company Admin.
router.use(authenticateToken, requireCompanyAdmin);

router.post("/", verifyCsrfToken, validate(createStaffSchema), createStaff);
router.get("/", getStaff);
router.get("/:id", getStaffById);
router.patch("/:id", verifyCsrfToken, validate(updateStaffSchema), updateStaff);
router.patch(
  "/:id/status",
  verifyCsrfToken,
  validate(updateStaffStatusSchema),
  updateStaffStatus
);
router.post("/:id/invite", verifyCsrfToken, inviteStaff);
router.delete("/:id", verifyCsrfToken, deleteStaff);

export default router;
