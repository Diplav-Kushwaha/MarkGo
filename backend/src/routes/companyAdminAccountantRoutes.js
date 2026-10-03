import { Router } from "express";
import {
  createAccountant,
  getAccountants,
  getAccountantById,
  updateAccountant,
  updateAccountantStatus,
  inviteAccountant,
  deleteAccountant,
} from "../controllers/companyAdminAccountantController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import {
  createAccountantSchema,
  updateAccountantSchema,
  updateAccountantStatusSchema,
} from "../validators/accountantSchemas.js";

const router = Router();

// Every accountant route requires a logged-in Company Admin.
router.use(authenticateToken, requireCompanyAdmin);

router.post("/", verifyCsrfToken, validate(createAccountantSchema), createAccountant);
router.get("/", getAccountants);
router.get("/:id", getAccountantById);
router.patch("/:id", verifyCsrfToken, validate(updateAccountantSchema), updateAccountant);
router.patch(
  "/:id/status",
  verifyCsrfToken,
  validate(updateAccountantStatusSchema),
  updateAccountantStatus
);
router.post("/:id/invite", verifyCsrfToken, inviteAccountant);
router.delete("/:id", verifyCsrfToken, deleteAccountant);

export default router;
