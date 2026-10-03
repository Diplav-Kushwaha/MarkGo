import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settingsController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { updateSettingsSchema } from "../validators/settingsValidators.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin);

router.get("/", getSettings);
router.patch("/", verifyCsrfToken, validate(updateSettingsSchema), updateSettings);

export default router;
