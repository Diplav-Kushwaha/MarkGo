import * as companySubscriptionService from "../services/companySubscriptionService.js";

/**
 * Company-admin subscription routes.
 *
 * The company is always the logged-in user's own — it is read from
 * req.user.companyId and never from the request — so one company can never see
 * or change another's subscription.
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

/** GET /api/admin/subscription */
export async function getMySubscription(req, res) {
  try {
    const result = await companySubscriptionService.getMySubscription({
      companyId: req.user.companyId,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getMySubscription error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: clientMessage(err) });
  }
}

/** GET /api/admin/subscription/history */
export async function getMyHistory(req, res) {
  try {
    const { page, pageSize } = req.validatedQuery || {};
    const result = await companySubscriptionService.getMyHistory({
      companyId: req.user.companyId,
      page,
      pageSize,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getMyHistory error:", err);
    return res
      .status(err.status || 500)
      .json({ success: false, message: clientMessage(err) });
  }
}

/** POST /api/admin/subscription/purchase */
export async function purchasePlan(req, res) {
  try {
    const result = await companySubscriptionService.purchasePlan({
      companyId: req.user.companyId,
      userId: req.user.userId,
      planId: req.body.planId,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("purchasePlan error:", err);
    return res
      .status(err.status || 500)
      .json({
        success: false,
        message: clientMessage(err),
        ...(err.data ? { data: err.data } : {}),
      });
  }
}

/** POST /api/admin/subscription/start-free */
export async function startFree(req, res) {
  try {
    const result = await companySubscriptionService.startFree({
      companyId: req.user.companyId,
      userId: req.user.userId,
      confirm: req.body?.confirm,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("startFree error:", err);
    return res
      .status(err.status || 500)
      .json({
        success: false,
        message: clientMessage(err),
        ...(err.data ? { data: err.data } : {}),
      });
  }
}
