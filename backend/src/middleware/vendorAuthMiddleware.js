import prisma from "../prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";

function extractToken(req) {
  if (req.cookies && req.cookies.vendorAccessToken) {
    return req.cookies.vendorAccessToken;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
}

export async function authenticateVendorToken(req, res, next) {
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

    const { userId: vendorId, role } = decoded;
    if (!vendorId || role !== "VENDOR") {
      return res.status(401).json({ success: false, message: "Malformed authentication token." });
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor || vendor.status !== "ACTIVE") {
      return res.status(401).json({ success: false, message: "Vendor account no longer active." });
    }

    req.vendor = {
      vendorId: vendor.id,
      companyId: vendor.companyId,
      email: vendor.email,
    };
    next();
  } catch (err) {
    console.error("authenticateVendorToken error:", err);
    return res.status(500).json({ success: false, message: "Internal authentication error." });
  }
}
