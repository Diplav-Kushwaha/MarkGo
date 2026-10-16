import { rotateRefreshToken, revokeRefreshToken } from "../services/tokenService.js";
import { getAccessCookieOptions, getRefreshCookieOptions } from "../utils/tokens.js";

/**
 * POST /api/auth/refresh
 *
 * Rotates the standard User refresh token (Company Admin / Super Admin) and
 * reissues the access cookie. Vendor and Customer portals
 * each have their own refresh endpoint.
 */
export async function refreshTokens(req, res) {
  try {
    const rotated = await rotateRefreshToken(req.cookies?.refreshToken, req);

    if (rotated?.error || !rotated?.accessToken || !rotated?.refreshCookieValue) {
      res.clearCookie("accessToken", { ...getAccessCookieOptions(), maxAge: undefined });
      res.clearCookie("refreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });
      const reused = rotated?.error === "reuse_detected";
      return res.status(401).json({
        success: false,
        code: reused ? "REFRESH_TOKEN_REUSE_DETECTED" : "REFRESH_TOKEN_INVALID",
        message: reused ? "Refresh token is no longer valid." : "Unable to refresh session.",
      });
    }

    res.cookie("accessToken", rotated.accessToken, getAccessCookieOptions());
    res.cookie("refreshToken", rotated.refreshCookieValue, getRefreshCookieOptions());

    return res.status(200).json({ success: true, message: "Session refreshed." });
  } catch (err) {
    console.error("refreshTokens error:", err);

    res.clearCookie("accessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("refreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });

    return res.status(401).json({
      success: false,
      code: "REFRESH_FAILED",
      message: "Unable to refresh session.",
    });
  }
}

/**
 * POST /api/auth/logout
 * Revokes the refresh token server side so it cannot be replayed.
 */
export async function logoutUser(req, res) {
  try {
    await revokeRefreshToken(req.cookies?.refreshToken);

    res.clearCookie("accessToken", { ...getAccessCookieOptions(), maxAge: undefined });
    res.clearCookie("refreshToken", { ...getRefreshCookieOptions(), maxAge: undefined });

    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("logoutUser error:", err);
    return res.status(500).json({ success: false, message: "Internal server error during logout." });
  }
}
