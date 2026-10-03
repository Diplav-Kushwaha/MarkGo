import prisma from "../prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";

 // Extracts the access token from the httpOnly "accessToken" cookie, falling

function extractToken(req) {
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  return null;
}

 // Verifies the (short-lived, ~15 min) access token and attaches a fresh
 
export async function authenticateToken(req, res, next) {
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

    const { userId, role } = decoded;
    if (!userId || !role) {
      return res.status(401).json({ success: false, message: "Malformed authentication token." });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ success: false, message: "User account no longer exists." });
    }

    req.user = {
      userId: user.id,
      role: user.role,
      companyId: user.companyId,
      email: user.email,
    };
    next();
  } catch (err) {
    console.error("authenticateToken error:", err);
    return res.status(500).json({ success: false, message: "Internal authentication error." });
  }
}

// Must run AFTER authenticateToken. Restricts access to SUPERADMIN only.

export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated." });
  }
  if (req.user.role !== "SUPERADMIN") {
    return res.status(403).json({ success: false, message: "Superadmin access required." });
  }
  next();
}

export function requireCompanyAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Not authenticated." });
  }
  if (req.user.role !== "COMPANY_ADMIN") {
    return res.status(403).json({ success: false, message: "Company Admin access required." });
  }
  if (!req.user.companyId) {
    return res.status(403).json({ success: false, message: "No company associated with this account." });
  }
  next();
}

// Restricts a route to an explicit set of roles. Must run AFTER authenticateToken.
// Usage: router.post("/", authenticateToken, requireRole("COMPANY_ADMIN", "MEMBER"), handler)
export function requireRole(...roles) {
  const allowed = roles.flat().filter(Boolean);
  if (allowed.length === 0) {
    throw new Error("requireRole() requires at least one role.");
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated." });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }
    if (req.user.role !== "SUPERADMIN" && !req.user.companyId) {
      return res.status(403).json({ success: false, message: "No company associated with this account." });
    }
    next();
  };
}
