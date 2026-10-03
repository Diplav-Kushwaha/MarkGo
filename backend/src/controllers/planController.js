import * as subscriptionService from "../services/subscriptionService.js";

/**
 * GET /api/plans
 *
 * Public: no login and no CSRF, because this is a read-only GET that the
 * public plans page calls before anyone has registered or signed in.
 */
export async function listActivePlans(req, res) {
  try {
    const plans = await subscriptionService.getActivePlans();

    return res.status(200).json({
      success: true,
      data: { plans: plans.map(subscriptionService.toPlanDto) },
    });
  } catch (err) {
    console.error("listActivePlans error:", err);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}