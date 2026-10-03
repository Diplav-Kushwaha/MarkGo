import * as billService from "../services/billService.js";

export async function createBill(req, res) {
  try {
    const bill = await billService.createBill({
      companyId: req.user.companyId,
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Bill created.", data: bill });
  } catch (err) {
    console.error("createBill error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getBills(req, res) {
  try {
    const result = await billService.listBills({
      companyId: req.user.companyId,
      ...(req.validatedQuery || req.query),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getBills error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getBillSummary(req, res) {
  try {
    const summary = await billService.getBillSummary({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    console.error("getBillSummary error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getBillById(req, res) {
  try {
    const bill = await billService.getBillById({
      companyId: req.user.companyId,
      billId: req.params.id,
    });
    return res.status(200).json({ success: true, data: bill });
  } catch (err) {
    console.error("getBillById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function updateBill(req, res) {
  try {
    const bill = await billService.updateBill({
      companyId: req.user.companyId,
      billId: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Bill updated.", data: bill });
  } catch (err) {
    console.error("updateBill error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function recordBillPayment(req, res) {
  try {
    const payment = await billService.recordBillPayment({
      companyId: req.user.companyId,
      userId: req.user.userId,
      billId: req.params.id,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Payment recorded.", data: payment });
  } catch (err) {
    console.error("recordBillPayment error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function markBillPaid(req, res) {
  try {
    const bill = await billService.markBillAsPaid({
      companyId: req.user.companyId,
      userId: req.user.userId,
      billId: req.params.id,
      paymentDate: req.body?.paymentDate ? new Date(req.body.paymentDate) : new Date(),
      method: req.body?.method,
      note: req.body?.note,
    });
    return res.status(200).json({ success: true, message: "Bill marked as paid.", data: bill });
  } catch (err) {
    console.error("markBillPaid error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
