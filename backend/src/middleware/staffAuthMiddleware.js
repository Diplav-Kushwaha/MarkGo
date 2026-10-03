import prisma from "../prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";

function extractToken(req) {
  if (req.cookies && req.cookies.staffAccessToken) {
    return req.cookies.staffAccessToken;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
}

export async function authenticateStaffToken(req, res, next) {
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

    const { userId: staffId, role } = decoded;
    if (!staffId || role !== "STAFF") {
      return res.status(401).json({ success: false, message: "Malformed authentication token." });
    }

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.status !== "ACTIVE") {
      return res.status(401).json({ success: false, message: "Staff account no longer active." });
    }

    req.staff = {
      staffId: staff.id,
      companyId: staff.companyId,
      email: staff.email,
    };
    next();
  } catch (err) {
    console.error("authenticateStaffToken error:", err);
    return res.status(500).json({ success: false, message: "Internal authentication error." });
  }
}
