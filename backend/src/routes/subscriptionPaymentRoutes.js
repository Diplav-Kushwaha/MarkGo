import { Router } from "express";
import {
  getPaymentSummary,
  confirmPayment,
  failPayment,
} from "../controllers/subscriptionPaymentController.js";
import { subscriptionPaymentLimiter } from "../middleware/rateLimiter.js";
import { verifyCsrfToken } from "../middleware/csrf.js";
import { validateParams } from "../middleware/validate.js";
import { paymentIdParamSchema } from "../validators/subscriptionSchemas.js";

const router = Router();

// Public dummy-payment routes: no login, because a paid registration issues no
// session until the payment succeeds. CSRF handling matches the public register
// route, with its own roomier payment limiter; only the payment id is
// validated, the POSTs take no body.
//
// The id lives in the path, so it is checked with validateParams, not validate.
// A malformed id is answered 404 "Payment not found." rather than a generic 400,
// so the payment page shows its normal not-found state instead of an error —
// a bad id and a missing row are the same thing to this API.
router.get(
  "/:paymentId",
  subscriptionPaymentLimiter,
  validateParams(paymentIdParamSchema, {
    status: 404,
    message: "Payment not found.",
  }),
  getPaymentSummary
);
router.post(
  "/:paymentId/confirm",
  subscriptionPaymentLimiter,
  verifyCsrfToken,
  validateParams(paymentIdParamSchema, {
    status: 404,
    message: "Payment not found.",
  }),
  confirmPayment
);
router.post(
  "/:paymentId/fail",
  subscriptionPaymentLimiter,
  verifyCsrfToken,
  validateParams(paymentIdParamSchema, {
    status: 404,
    message: "Payment not found.",
  }),
  failPayment
);

export default router;