import { enforceSubscription } from "../config/subscription.js";
import { getSubscriptionState } from "../services/subscriptionService.js";
import prisma from "../prisma.js";

export async function requireActiveSubscription(req, res, next) {
  const companyId = req.user?.companyId;
  if (!companyId) return next();

  try {
    const [company, subscription] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { status: true },
      }),
      getSubscriptionState(companyId),
    ]);

    const allowed = company?.status === "ACTIVE" && subscription.state === "VALID";
    if (allowed) return next();

    if (!enforceSubscription) {
      console.warn(`[subscription] would block companyId=${companyId}`);
      return next();
    }

    return res.status(403).json({
      success: false,
      code: "SUBSCRIPTION_REQUIRED",
      message: "An active subscription is required to access this feature.",
    });
  } catch (err) {
    return next(err);
  }
}
