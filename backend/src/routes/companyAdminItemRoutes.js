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
} from "../controllers/companyAdminItemController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import {
  createItemSchema,
  updateItemSchema,
  updateItemStatusSchema,
  bulkActionItemSchema,
} from "../validators/itemSchemas.js";

const router = Router();

// Every item route requires an authenticated Company Admin.
router.use(authenticateToken, requireCompanyAdmin);

router.get("/stats", getItemStats);
router.get("/export", exportItems);
router.post("/bulk", verifyCsrfToken, validate(bulkActionItemSchema), bulkActionItems);

router.post("/", verifyCsrfToken, validate(createItemSchema), createItem);
router.get("/", getItems);
router.get("/:id", getItemById);
router.patch("/:id", verifyCsrfToken, validate(updateItemSchema), updateItem);
router.patch("/:id/status", verifyCsrfToken, validate(updateItemStatusSchema), updateItemStatus);
router.delete("/:id", verifyCsrfToken, deleteItem);

export default router;
