import * as subscriptionPaymentService from "../services/subscriptionPaymentService.js";

/**
 * Public dummy-payment routes.
 *
 * No login: the user reaching the payment page has not signed in yet (a paid
 * registration deliberately issues no session). Nothing sensitive is returned —
 * only the summary shape from getPaymentSummary.
 */

/**
 * What the browser is told about a failure. Errors we raise on purpose carry a
 * status and a message meant for the user, so they pass through untouched. An
 * unexpected one (a bad query, a dropped connection) has no status and its
 * message is raw driver text, so in production the client gets a generic line —
 * the full error has already been logged above.
 */
function clientMessage(err) {
  if (err.status) return err.message;
  if (process.env.NODE_ENV === "production") return "Something went wrong. Please try again.";
  return err.message || "Internal server error.";
}

export async function getPaymentSummary(req, res) {
  try {
    const summary = await subscriptionPaymentService.getPaymentSummary(req.params.paymentId);
    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    console.error("getPaymentSummary error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: clientMessage(err) });
  }
}

export async function confirmPayment(req, res) {
  try {
    const result = await subscriptionPaymentService.confirmPayment(req.params.paymentId, {
      ip: req.ip,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("confirmSubscriptionPayment error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: clientMessage(err) });
  }
}

export async function failPayment(req, res) {
  try {
    const result = await subscriptionPaymentService.failPayment(req.params.paymentId, { ip: req.ip });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("failSubscriptionPayment error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: clientMessage(err) });
  }
}
