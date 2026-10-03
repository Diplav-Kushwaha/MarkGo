import prisma from "../prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";

// Separate cookie name ("customerAccessToken") from the admin flow's
// "accessToken", so an admin session and a customer session can coexist in
// the same browser without clobbering each other's cookies.
function extractToken(req) {
  if (req.cookies && req.cookies.customerAccessToken) {
    return req.cookies.customerAccessToken;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
}

// Mirrors authenticateToken in authMiddleware.js, but looks the subject up
// in Customer instead of User.
export async function authenticateCustomerToken(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication token missing." });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ success: false, message: "Access token expired.", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ success: false, message: "Invalid authentication token." });
    }

    // `userId` is just the JWT's subject-claim field name from tokens.js —
    // here it holds a customer id, not a User id.
    const { userId: customerId, role } = decoded;
    if (!customerId || role !== "CUSTOMER") {
      return res.status(401).json({ success: false, message: "Malformed authentication token." });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.status !== "ACTIVE") {
      return res.status(401).json({ success: false, message: "Customer account no longer active." });
    }

    req.customer = {
      customerId: customer.id,
      companyId: customer.companyId,
      email: customer.email,
    };
    next();
  } catch (err) {
    console.error("authenticateCustomerToken error:", err);
    return res.status(500).json({ success: false, message: "Internal authentication error." });
  }
}
