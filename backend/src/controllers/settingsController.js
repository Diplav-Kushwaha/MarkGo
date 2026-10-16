import * as settingsService from "../services/settingsService.js";
import { normalizePhone } from "../utils/phone.js";

export async function getSettings(req, res) {
  try {
    const settings = await settingsService.getSettings({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: settings });
  } catch (err) {
    console.error("getSettings error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function updateSettings(req, res) {
  try {
    const settings = await settingsService.updateSettings({
      companyId: req.user.companyId,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Settings updated.", data: settings });
  } catch (err) {
    console.error("updateSettings error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getCompanyDetails(req, res) {
  try {
    const company = await settingsService.getCompanyDetails({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: company });
  } catch (err) {
    console.error("getCompanyDetails error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function updateCompanyDetails(req, res) {
  try {
    const company = await settingsService.updateCompanyDetails({
      companyId: req.user.companyId,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Company details updated.", data: company });
  } catch (err) {
    console.error("updateCompanyDetails error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getAdminProfile(req, res) {
  try {
    const user = await settingsService.getAdminProfile({ userId: req.user.userId });
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error("getAdminProfile error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function updateAdminProfile(req, res) {
  try {
    const user = await settingsService.updateAdminProfile({
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Profile updated.", data: user });
  } catch (err) {
    console.error("updateAdminProfile error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}