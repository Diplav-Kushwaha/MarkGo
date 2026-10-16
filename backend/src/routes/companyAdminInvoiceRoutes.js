import { Router } from "express";
import {
  createInvoice,
  getInvoices,
  getInvoiceSummary,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  handleStatusAction,
  recordPayment,
  duplicateInvoice,
  generatePdf,
  emailInvoice,
} from "../controllers/invoiceController.js";
import { authenticateToken, requireCompanyAdmin } from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/requireActiveSubscription.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate, validateQuery } from "../middleware/validate.js";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  recordPaymentSchema,
  invoiceStatusActionSchema,
  listInvoicesQuerySchema,
} from "../validators/invoiceValidators.js";

const router = Router();

// Invoices require a logged-in Company Admin
router.use(authenticateToken, requireCompanyAdmin, requireActiveSubscription);

router.get("/summary", getInvoiceSummary);

router.post("/", verifyCsrfToken, validate(createInvoiceSchema), createInvoice);
router.get("/", validateQuery(listInvoicesQuerySchema), getInvoices);
router.get("/:id", getInvoiceById);
router.put("/:id", verifyCsrfToken, validate(updateInvoiceSchema), updateInvoice);
router.delete("/:id", verifyCsrfToken, deleteInvoice);

router.patch("/:id/status", verifyCsrfToken, validate(invoiceStatusActionSchema), handleStatusAction);
router.post("/:id/payments", verifyCsrfToken, validate(recordPaymentSchema), recordPayment);
router.post("/:id/duplicate", verifyCsrfToken, duplicateInvoice);

router.get("/:id/pdf", generatePdf);
router.post("/:id/email", verifyCsrfToken, emailInvoice);

export default router;
