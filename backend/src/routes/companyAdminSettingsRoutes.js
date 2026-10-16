import { Router } from "express";
import {
  getSettings,
  updateSettings,
  getCompanyDetails,
  updateCompanyDetails,
  getAdminProfile,
  updateAdminProfile,
} from "../controllers/settingsController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { updateSettingsSchema, updateCompanySchema, updateAdminProfileSchema } from "../validators/settingsValidators.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin, requireActiveSubscription);

// Company Settings (invoicing, etc.)
router.get("/", getSettings);
router.patch("/", verifyCsrfToken, validate(updateSettingsSchema), updateSettings);

// Company Details
router.get("/company", getCompanyDetails);
router.patch("/company", verifyCsrfToken, validate(updateCompanySchema), updateCompanyDetails);

// Admin Profile
router.get("/profile", getAdminProfile);
router.patch("/profile", verifyCsrfToken, validate(updateAdminProfileSchema), updateAdminProfile);

export default router;
