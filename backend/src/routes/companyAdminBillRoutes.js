import { Router } from "express";
import {
  createBill,
  getBills,
  getBillSummary,
  getBillById,
  updateBill,
  recordBillPayment,
  markBillPaid,
} from "../controllers/billController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate, validateQuery } from "../middleware/validate.js";
import {
  createBillSchema,
  updateBillSchema,
  recordBillPaymentSchema,
  listBillsQuerySchema,
} from "../validators/billValidators.js";

const router = Router();

router.use(authenticateToken, requireCompanyAdmin, requireActiveSubscription);

router.get("/summary", getBillSummary);

router.post("/", verifyCsrfToken, validate(createBillSchema), createBill);
router.get("/", validateQuery(listBillsQuerySchema), getBills);
router.get("/:id", getBillById);
router.put("/:id", verifyCsrfToken, validate(updateBillSchema), updateBill);

router.post("/:id/payments", verifyCsrfToken, validate(recordBillPaymentSchema), recordBillPayment);
router.post("/:id/mark-paid", verifyCsrfToken, markBillPaid);

// Bills are never hard deleted. They stay on record as part of the payment
// history and the vendor's payable ledger, so there is intentionally no
// DELETE route here.

export default router;
