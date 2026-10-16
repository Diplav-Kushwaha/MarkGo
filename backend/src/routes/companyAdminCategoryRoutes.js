import { Router } from "express";
import {
  createCategory,
  getCategories,
  getCategoryOptions,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/companyAdminCategoryController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { createCategorySchema, updateCategorySchema } from "../validators/categorySchemas.js";

const router = Router();

// Every category route requires an authenticated Company Admin.
router.use(authenticateToken, requireCompanyAdmin, requireActiveSubscription);

router.get("/options", getCategoryOptions);

router.post("/", verifyCsrfToken, validate(createCategorySchema), createCategory);
router.get("/", getCategories);
router.get("/:id", getCategoryById);
router.patch("/:id", verifyCsrfToken, validate(updateCategorySchema), updateCategory);
router.delete("/:id", verifyCsrfToken, deleteCategory);

export default router;
