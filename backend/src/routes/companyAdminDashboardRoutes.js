import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin);

router.get("/", getDashboard);

export default router;