import { Router } from "express";
import {
  getPaymentSummary,
  confirmPayment,
  failPayment,
} from "../controllers/subscriptionPaymentController.js";
import { subscriptionPaymentLimiter } from "../middleware/rateLimiter.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validate } from "../middleware/validate.js";
import { paymentIdParamSchema } from "../validators/subscriptionSchemas.js";

const router = Router();

// Public dummy-payment routes: no login, because a paid registration issues no
// session until the payment succeeds. CSRF handling matches the public register
// route, with its own roomier payment limiter; only the payment id is
// validated, the POSTs take no body.
router.get(
  "/:paymentId",
  subscriptionPaymentLimiter,
  validate(paymentIdParamSchema),
  getPaymentSummary
);
router.post(
  "/:paymentId/confirm",
  subscriptionPaymentLimiter,
  verifyCsrfToken,
  validate(paymentIdParamSchema),
  confirmPayment
);
router.post(
  "/:paymentId/fail",
  subscriptionPaymentLimiter,
  verifyCsrfToken,
  validate(paymentIdParamSchema),
  failPayment
);

export default router;