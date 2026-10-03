import * as paymentService from "../services/paymentService.js";

export async function recordInvoicePayment(req, res) {
  try {
    const payment = await paymentService.recordInvoicePayment({
      companyId: req.user.companyId,
      userId: req.user.userId,
      invoiceId: req.params.invoiceId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Payment recorded.", data: payment });
  } catch (err) {
    console.error("recordInvoicePayment error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function recordBillPayment(req, res) {
  try {
    const payment = await paymentService.recordBillPayment({
      companyId: req.user.companyId,
      userId: req.user.userId,
      billId: req.params.billId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Payment recorded.", data: payment });
  } catch (err) {
    console.error("recordBillPayment error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getPayments(req, res) {
  try {
    const result = await paymentService.listPayments({
      companyId: req.user.companyId,
      ...(req.validatedQuery || req.query),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getPayments error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getPaymentSummary(req, res) {
  try {
    const summary = await paymentService.getPaymentSummary({
      companyId: req.user.companyId,
      ...(req.validatedQuery || req.query),
    });
    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    console.error("getPaymentSummary error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}
