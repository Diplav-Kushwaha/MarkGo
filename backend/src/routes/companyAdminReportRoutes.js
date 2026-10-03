import { Router } from "express";
import { getSalesReport, getOutstandingReport } from "../controllers/reportController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { validateQuery } from "../middleware/validate.js";
import { salesReportQuerySchema } from "../validators/reportValidators.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin);

router.get("/sales", validateQuery(salesReportQuerySchema), getSalesReport);
router.get("/outstanding", getOutstandingReport);

export default router;
