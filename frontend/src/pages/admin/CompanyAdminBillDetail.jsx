import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Pencil, Printer, Wallet } from "lucide-react";
import { getBillById, markBillPaid, recordBillPayment } from "../../api/billAdminApi";
import BillStatusBadge from "../../components/bills/BillStatusBadge";
import RecordBillPaymentModal from "../../components/bills/RecordBillPaymentModal";
import { formatCurrency, formatDate, humanize } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  Skeleton,
} from "../../components/ui";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export default function CompanyAdminBillDetail({ billId, onBack, onEdit }) {
  const { company } = useAuth();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const refreshBill = useCallback(async () => {
    try {
      const res = await getBillById(billId);
      if (res.success) setBill(res.data);
    } catch {
      // Keep the previously loaded bill on screen when a background refresh fails.
    }
  }, [billId]);

  useEffect(() => {
    let active = true;

    getBillById(billId)
      .then((res) => {
        if (!active) return;
        if (res.success) setBill(res.data);
        else setError("Bill not found.");
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Failed to load bill details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [billId]);

  const handleRecordPayment = async (payload) => {
    await recordBillPayment(billId, payload);
    await refreshBill();
  };

  const handleMarkPaid = async () => {
    try {
      setMarkingPaid(true);
      setActionError("");
      await markBillPaid(billId);
      setMarkPaidOpen(false);
      await refreshBill();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to mark bill as paid.");
    } finally {
      setMarkingPaid(false);
    }
  };

  // Opens a self-contained printable document, since there is no bill PDF endpoint.
  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) {
      setActionError("Please allow popups to print this document.");
      return;
    }

    const itemRows =
      (bill.items || [])
        .map(
          (item) => `
        <tr>
          <td>${escapeHtml(item.description)}</td>
          <td class="num">${Number(item.quantity)}</td>
          <td class="num">${formatCurrency(item.unitPrice)}</td>
          <td class="num">${formatCurrency(item.amount ?? (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}</td>
        </tr>`
        )
        .join("") || `<tr><td colspan="4" class="empty">No line items</td></tr>`;

    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${escapeHtml(bill.billNumber)}</title>
<style>
  @page { margin: 15mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 12px; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 1px; }
  .muted { color: #444; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; }
  .meta { display: flex; gap: 24px; margin: 16px 0; }
  .meta div { min-width: 150px; }
  .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #444; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th { background: #eee; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  td.num, th.num { text-align: right; }
  td.empty { text-align: center; color: #666; }
  .totals { margin-top: 16px; margin-left: auto; width: 260px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #000; margin-top: 4px; padding-top: 6px; font-weight: bold; font-size: 14px; }
  .notes { margin-top: 24px; border-top: 1px solid #999; padding-top: 10px; }
  .footer { margin-top: 32px; font-size: 10px; text-align: center; color: #444; }
</style></head>
<body>
  <div class="header">
    <div>
      <h1>Bill</h1>
      <div><strong>${escapeHtml(bill.billNumber)}</strong></div>
    </div>
    <div style="text-align:right">
      <strong>${escapeHtml(company?.name || "Company")}</strong>
      ${company?.address ? `<div class="muted">${escapeHtml(company.address)}</div>` : ""}
      ${company?.gstNumber ? `<div class="muted">GSTIN: ${escapeHtml(company.gstNumber)}</div>` : ""}
    </div>
  </div>
  <div class="meta">
    <div>
      <div class="label">Vendor</div>
      <strong>${escapeHtml(bill.vendor?.name || "N/A")}</strong>
      <div class="muted">${escapeHtml(bill.vendor?.email || "")}</div>
    </div>
    <div>
      <div class="label">Bill Date</div>
      <div>${formatDate(bill.billDate)}</div>
    </div>
    <div>
      <div class="label">Due Date</div>
      <div>${formatDate(bill.dueDate)}</div>
    </div>
    <div>
      <div class="label">Status</div>
      <div>${escapeHtml(bill.status || "")}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Amount</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="totals">
    <div><span>Total</span><span>${formatCurrency(bill.total)}</span></div>
    <div><span>Paid</span><span>${formatCurrency(bill.amountPaid)}</span></div>
    <div class="grand"><span>Amount Due</span><span>${formatCurrency(bill.amountDue)}</span></div>
  </div>
  ${bill.notes ? `<div class="notes"><div class="label">Notes</div><div>${escapeHtml(bill.notes)}</div></div>` : ""}
  <div class="footer">Generated by MarkGo</div>
</body></html>`);

    win.document.close();
    win.focus();
    win.print();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Card>
          <CardBody className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </CardBody>
        </Card>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <>
        <PageHeader
          title="Bill"
          actions={
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
          }
        />
        <Alert tone="error" title="Could not load this bill">
          {error || "Bill not found."}
        </Alert>
      </>
    );
  }

  const payments = bill.payments || [];
  const hasOutstanding = Number(bill.amountDue) > 0;
  const editable = bill.status === "UNPAID" && payments.length === 0;

  const paymentColumns = [
    { key: "paymentDate", header: "Date", render: (row) => formatDate(row.paymentDate) },
    {
      key: "method",
      header: "Method",
      render: (row) => humanize(row.method),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <span className="font-medium text-success">{formatCurrency(row.amount)}</span>,
    },
    {
      key: "reference",
      header: "Reference",
      render: (row) => row.reference || <span className="text-muted">—</span>,
    },
    {
      key: "note",
      header: "Note",
      render: (row) => row.note || <span className="text-muted">—</span>,
    },
    {
      key: "recordedBy",
      header: "Recorded by",
      render: (row) => row.recordedBy?.fullName || <span className="text-muted">—</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={bill.billNumber}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{bill.vendor?.name}</span>
            <span className="text-line-strong">·</span>
            <span>Billed {formatDate(bill.billDate)}</span>
            <BillStatusBadge status={bill.status} />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            <Button variant="secondary" onClick={handlePrint}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print
            </Button>
            {editable && (
              <Button variant="secondary" onClick={() => onEdit(billId)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            )}
            {hasOutstanding && (
              <>
                <Button variant="secondary" onClick={() => setMarkPaidOpen(true)}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Mark as paid
                </Button>
                <Button onClick={() => setIsPaymentOpen(true)}>
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  Record payment
                </Button>
              </>
            )}
          </>
        }
      />

      {(actionError || error) && (
        <Alert className="mb-4" tone="error">
          {actionError || error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Left: vendor + line items + notes */}
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardBody className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Vendor</h3>
                <p className="text-sm font-semibold text-ink">{bill.vendor?.name || "—"}</p>
                {bill.vendor?.email && <p className="mt-0.5 text-sm text-body">{bill.vendor.email}</p>}
                {bill.category && (
                  <p className="mt-2 text-sm text-body">Category: {humanize(bill.category)}</p>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">From</h3>
                <p className="text-sm font-semibold text-ink">{company?.name || "Company"}</p>
                {company?.address && (
                  <p className="mt-0.5 whitespace-pre-line text-sm text-body">{company.address}</p>
                )}
                {company?.gstNumber && (
                  <p className="mt-1 font-mono text-xs text-muted">GSTIN: {company.gstNumber}</p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Line items"
              description={
                bill.items?.length
                  ? `${bill.items.length} line(s) on this bill`
                  : "This bill was recorded as a single amount"
              }
            />
            <DataTable
              contained
              columns={[
                {
                  key: "description",
                  header: "Description",
                  render: (row) => <span className="font-medium text-ink">{row.description}</span>,
                },
                { key: "quantity", header: "Qty", align: "right", render: (row) => Number(row.quantity) },
                {
                  key: "unitPrice",
                  header: "Unit price",
                  align: "right",
                  render: (row) => formatCurrency(row.unitPrice),
                },
                {
                  key: "amount",
                  header: "Amount",
                  align: "right",
                  render: (row) => (
                    <span className="font-medium text-ink">
                      {formatCurrency(
                        row.amount ?? (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0)
                      )}
                    </span>
                  ),
                },
              ]}
              rows={bill.items || []}
              empty={
                <EmptyState
                  compact
                  icon={Wallet}
                  title="Recorded as a single amount"
                  description={`No line items — total ${formatCurrency(bill.total)}.`}
                />
              }
            />
          </Card>

          {bill.notes && (
            <Card>
              <CardHeader title="Notes" description="Internal notes about this bill." />
              <CardBody>
                <p className="whitespace-pre-line text-sm text-body">{bill.notes}</p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Right: summary + payments */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Summary" />
            <CardBody className="space-y-2.5">
              <div className="grid grid-cols-2 gap-4 border-b border-line pb-4">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Bill date</dt>
                  <dd className="mt-0.5 text-sm text-ink">{formatDate(bill.billDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Due date</dt>
                  <dd className="mt-0.5 text-sm text-ink">{formatDate(bill.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Category</dt>
                  <dd className="mt-0.5 text-sm text-ink">{humanize(bill.category) || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Status</dt>
                  <dd className="mt-0.5">
                    <BillStatusBadge status={bill.status} />
                  </dd>
                </div>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-body">Total</span>
                  <span className="font-medium text-ink">{formatCurrency(bill.total)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-body">Paid</span>
                  <span className="font-medium text-success">{formatCurrency(bill.amountPaid)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-body">Amount due</span>
                <span className={`text-xl font-semibold ${hasOutstanding ? "text-danger" : "text-success"}`}>
                  {formatCurrency(bill.amountDue)}
                </span>
              </div>

              {hasOutstanding && (
                <div className="space-y-2">
                  <Button className="w-full justify-center" onClick={() => setIsPaymentOpen(true)}>
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Record payment
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-center"
                    onClick={() => setMarkPaidOpen(true)}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Mark as paid
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Payment history" description={`${payments.length} payment(s) recorded`} />
            <DataTable
              contained
              columns={paymentColumns}
              rows={payments}
              empty={
                <EmptyState
                  compact
                  icon={Wallet}
                  title="No payments yet"
                  description="Payments recorded against this bill will appear here."
                />
              }
            />
          </Card>
        </div>
      </div>

      {isPaymentOpen && (
        <RecordBillPaymentModal
          isOpen
          onClose={() => setIsPaymentOpen(false)}
          bill={bill}
          onRecord={handleRecordPayment}
        />
      )}

      <Modal
        isOpen={markPaidOpen}
        onClose={() => setMarkPaidOpen(false)}
        size="sm"
        title="Mark bill as paid"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMarkPaidOpen(false)}>
              Cancel
            </Button>
            <Button loading={markingPaid} onClick={handleMarkPaid}>
              Mark as paid
            </Button>
          </>
        }
      >
        <p className="text-sm text-body">
          This will settle the full outstanding balance of{" "}
          <span className="font-medium text-ink">{formatCurrency(bill.amountDue)}</span> for{" "}
          {bill.billNumber}.
        </p>
      </Modal>
    </>
  );
}
