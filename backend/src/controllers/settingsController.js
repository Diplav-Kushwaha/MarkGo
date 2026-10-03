import * as settingsService from "../services/settingsService.js";

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
