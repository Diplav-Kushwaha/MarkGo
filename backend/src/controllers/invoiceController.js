import * as invoiceService from "../services/invoiceService.js";

export async function createInvoice(req, res) {
  try {
    const invoice = await invoiceService.createInvoice({
      companyId: req.user.companyId,
      userId: req.user.userId,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Invoice created.", data: invoice });
  } catch (err) {
    console.error("createInvoice error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getInvoices(req, res) {
  try {
    const result = await invoiceService.listInvoices({
      companyId: req.user.companyId,
      ...(req.validatedQuery || req.query),
    });
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getInvoices error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getInvoiceSummary(req, res) {
  try {
    const summary = await invoiceService.getInvoiceSummary({ companyId: req.user.companyId });
    return res.status(200).json({ success: true, data: summary });
  } catch (err) {
    console.error("getInvoiceSummary error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function getInvoiceById(req, res) {
  try {
    const invoice = await invoiceService.getInvoiceById({
      companyId: req.user.companyId,
      id: req.params.id,
    });
    return res.status(200).json({ success: true, data: invoice });
  } catch (err) {
    console.error("getInvoiceById error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function updateInvoice(req, res) {
  try {
    const invoice = await invoiceService.updateInvoice({
      companyId: req.user.companyId,
      id: req.params.id,
      payload: req.body,
    });
    return res.status(200).json({ success: true, message: "Invoice updated.", data: invoice });
  } catch (err) {
    console.error("updateInvoice error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function deleteInvoice(req, res) {
  try {
    await invoiceService.deleteInvoice({
      companyId: req.user.companyId,
      id: req.params.id,
    });
    return res.status(200).json({ success: true, message: "Invoice deleted successfully." });
  } catch (err) {
    console.error("deleteInvoice error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function handleStatusAction(req, res) {
  try {
    const invoice = await invoiceService.handleStatusAction({
      companyId: req.user.companyId,
      id: req.params.id,
      action: req.body.action,
    });
    return res.status(200).json({ success: true, message: `Action '${req.body.action}' completed.`, data: invoice });
  } catch (err) {
    console.error("handleStatusAction error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function recordPayment(req, res) {
  try {
    const payment = await invoiceService.recordPayment({
      companyId: req.user.companyId,
      userId: req.user.userId,
      id: req.params.id,
      payload: req.body,
    });
    return res.status(201).json({ success: true, message: "Payment recorded.", data: payment });
  } catch (err) {
    console.error("recordPayment error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function duplicateInvoice(req, res) {
  try {
    const invoice = await invoiceService.duplicateInvoice({
      companyId: req.user.companyId,
      userId: req.user.userId,
      id: req.params.id,
    });
    return res.status(201).json({ success: true, message: "Invoice duplicated.", data: invoice });
  } catch (err) {
    console.error("duplicateInvoice error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const money = (value, currency) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR" }).format(Number(value) || 0);

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

/**
 * Returns a self-contained, print-optimized HTML document. The browser renders
 * it on screen and "Save as PDF" in the print dialog produces the PDF, so no
 * PDF dependency is required.
 */
export async function generatePdf(req, res) {
  try {
    const invoice = await invoiceService.getInvoiceById({
      companyId: req.user.companyId,
      id: req.params.id,
    });

    const { company, customer, items } = invoice;
    const currency = invoice.currency || company?.currency || "INR";

    const itemRows = items
      .map(
        (item, index) => `
        <tr>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${index + 1}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${Number(item.quantity)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(item.unitPrice, currency)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${Number(item.taxRate)}%</td>
          <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${money(item.lineTotal, currency)}</td>
        </tr>`
      )
      .join("");

    const paymentRows = invoice.payments.length
      ? invoice.payments
          .map(
            (payment) => `
        <tr>
          <td style="padding:6px;border-bottom:1px solid #f3f4f6;">${formatDate(payment.paymentDate)}</td>
          <td style="padding:6px;border-bottom:1px solid #f3f4f6;">${escapeHtml(payment.method)}</td>
          <td style="padding:6px;border-bottom:1px solid #f3f4f6;">${escapeHtml(payment.reference || payment.note || "-")}</td>
          <td style="padding:6px;border-bottom:1px solid #f3f4f6;text-align:right;">${money(payment.amount, currency)}</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="4" style="padding:8px;color:#9ca3af;">No payments recorded yet.</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(invoice.invoiceNumber)}</title>
<style>
  @page { margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #111827; margin: 0; padding: 24px; font-size: 13px; }
  h1 { font-size: 22px; margin: 0; letter-spacing: -0.02em; }
  .muted { color: #6b7280; }
  .row { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; min-width: 220px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; border-bottom: 1px solid #d1d5db; padding: 8px 6px; }
  td { font-size: 12px; }
  .totals { margin-left: auto; width: 260px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { font-weight: 700; font-size: 15px; border-top: 1px solid #d1d5db; margin-top: 6px; padding-top: 8px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; border: 1px solid #d1d5db; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="row">
    <div>
      <h1>${escapeHtml(company?.name || "Invoice")}</h1>
      <p class="muted" style="margin:4px 0 0;">
        ${escapeHtml(company?.address || "")}<br />
        ${escapeHtml([company?.city, company?.country].filter(Boolean).join(", "))}<br />
        ${company?.gstNumber ? `GSTIN: ${escapeHtml(company.gstNumber)}` : ""}
      </p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:20px;font-weight:700;margin:0;">INVOICE</p>
      <p style="margin:4px 0 0;" class="muted">${escapeHtml(invoice.invoiceNumber)}</p>
      <p style="margin:0;" class="badge" style="margin-top:6px;">${escapeHtml(invoice.status)}</p>
    </div>
  </div>

  <div class="row" style="margin-top:20px;">
    <div class="card">
      <p class="muted" style="margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;">Bill To</p>
      <p style="margin:0;font-weight:600;">${escapeHtml(customer?.name || "-")}</p>
      <p class="muted" style="margin:2px 0 0;">${escapeHtml(customer?.email || "")}</p>
      ${customer?.phoneNumber ? `<p class="muted" style="margin:0;">${escapeHtml(customer.phoneNumber)}</p>` : ""}
      ${customer?.taxNumber ? `<p class="muted" style="margin:0;">Tax ID: ${escapeHtml(customer.taxNumber)}</p>` : ""}
    </div>
    <div class="card">
      <p class="muted" style="margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;">Details</p>
      <p style="margin:0;">Issue date: <strong>${formatDate(invoice.invoiceDate)}</strong></p>
      <p style="margin:0;">Due date: <strong>${formatDate(invoice.dueDate)}</strong></p>
      <p style="margin:0;" class="muted">Amount due: <strong>${money(invoice.amountDue, currency)}</strong></p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px;">#</th>
        <th>Description</th>
        <th style="text-align:right;width:60px;">Qty</th>
        <th style="text-align:right;width:100px;">Price</th>
        <th style="text-align:right;width:60px;">Tax</th>
        <th style="text-align:right;width:110px;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div><span class="muted">Subtotal</span><span>${money(invoice.subtotal, currency)}</span></div>
    ${Number(invoice.discountTotal) ? `<div><span class="muted">Discount</span><span>- ${money(invoice.discountTotal, currency)}</span></div>` : ""}
    <div><span class="muted">Tax</span><span>${money(invoice.taxTotal, currency)}</span></div>
    <div class="grand"><span>Total</span><span>${money(invoice.grandTotal, currency)}</span></div>
    <div><span class="muted">Paid</span><span>${money(invoice.amountPaid, currency)}</span></div>
    <div><span class="muted">Balance due</span><span><strong>${money(invoice.amountDue, currency)}</strong></span></div>
  </div>

  ${invoice.payments.length ? `
  <h3 style="margin:26px 0 0;font-size:13px;">Payments</h3>
  <table>
    <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${paymentRows}</tbody>
  </table>` : ""}

  ${invoice.notes ? `<h3 style="margin:26px 0 0;font-size:13px;">Notes</h3><p class="muted" style="white-space:pre-wrap;margin:4px 0 0;">${escapeHtml(invoice.notes)}</p>` : ""}
  ${invoice.termsAndConditions ? `<h3 style="margin:18px 0 0;font-size:13px;">Terms</h3><p class="muted" style="white-space:pre-wrap;margin:4px 0 0;">${escapeHtml(invoice.termsAndConditions)}</p>` : ""}

  <div class="no-print" style="margin-top:28px;display:flex;gap:10px;">
    <button onclick="window.print()" style="padding:9px 18px;border-radius:8px;border:0;background:#3ACF99;color:#fff;font-weight:600;cursor:pointer;">Print / Save as PDF</button>
    <button onclick="window.close()" style="padding:9px 18px;border-radius:8px;border:1px solid #d1d5db;background:#fff;color:#374151;font-weight:600;cursor:pointer;">Close</button>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (err) {
    console.error("generatePdf error:", err);
    return res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error." });
  }
}

export async function emailInvoice(req, res) {
  try {
    const err = new Error("Email delivery is not available yet.");
    err.status = 501;
    throw err;
  } catch (err) {
    console.error("emailInvoice error:", err);
    return res.status(501).json({ success: false, message: "Email functionality not yet implemented." });
  }
}
