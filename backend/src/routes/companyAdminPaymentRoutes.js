import { Router } from "express";
import {
  recordInvoicePayment,
  recordBillPayment,
  getPayments,
  getPaymentSummary,
} from "../controllers/paymentController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate, validateQuery } from "../middleware/validate.js";
import {
  recordPaymentSchema,
  listPaymentsQuerySchema,
  paymentSummaryQuerySchema,
} from "../validators/paymentValidators.js";

const router = Router();

// One table backs money in (invoices) and money out (bills). A payment row is
// tied to exactly one document, which the route shape makes explicit.
router.use(authenticateToken, requireCompanyAdmin);

router.get("/summary", validateQuery(paymentSummaryQuerySchema), getPaymentSummary);
router.get("/", validateQuery(listPaymentsQuerySchema), getPayments);

router.post("/invoice/:invoiceId", verifyCsrfToken, validate(recordPaymentSchema), recordInvoicePayment);
router.post("/bill/:billId", verifyCsrfToken, validate(recordPaymentSchema), recordBillPayment);

// Payments are a permanent audit trail and are never deleted.

export default router;
