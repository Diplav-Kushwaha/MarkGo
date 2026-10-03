import prisma from "../prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";

function extractToken(req) {
  if (req.cookies && req.cookies.accountantAccessToken) {
    return req.cookies.accountantAccessToken;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
}

export async function authenticateAccountantToken(req, res, next) {
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

    const { userId: accountantId, role } = decoded;
    if (!accountantId || role !== "ACCOUNTANT") {
      return res.status(401).json({ success: false, message: "Malformed authentication token." });
    }

    const accountant = await prisma.accountant.findUnique({ where: { id: accountantId } });
    if (!accountant || accountant.status !== "ACTIVE") {
      return res.status(401).json({ success: false, message: "Accountant account no longer active." });
    }

    req.accountant = {
      accountantId: accountant.id,
      companyId: accountant.companyId,
      email: accountant.email,
    };
    next();
  } catch (err) {
    console.error("authenticateAccountantToken error:", err);
    return res.status(500).json({ success: false, message: "Internal authentication error." });
  }
}
