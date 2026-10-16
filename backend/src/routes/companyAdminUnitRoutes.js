import { Router } from "express";
import {
  createUnit,
  getUnits,
  getUnitOptions,
  getUnitById,
  updateUnit,
  deleteUnit,
} from "../controllers/companyAdminUnitController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { createUnitSchema, updateUnitSchema } from "../validators/unitSchemas.js";

const router = Router();

// Every unit route requires an authenticated Company Admin.
router.use(authenticateToken, requireCompanyAdmin, requireActiveSubscription);

router.get("/options", getUnitOptions);

router.post("/", verifyCsrfToken, validate(createUnitSchema), createUnit);
router.get("/", getUnits);
router.get("/:id", getUnitById);
router.patch("/:id", verifyCsrfToken, validate(updateUnitSchema), updateUnit);
router.delete("/:id", verifyCsrfToken, deleteUnit);

export default router;
