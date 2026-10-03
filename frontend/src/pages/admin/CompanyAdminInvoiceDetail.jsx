import { useEffect, useState } from "react";
import { ArrowLeft, Ban, Mail, Pencil, Printer, Wallet } from "lucide-react";
import {
  getInvoiceById,
  getInvoicePrintHtml,
  handleInvoiceStatusAction,
  recordInvoicePayment,
} from "../../api/invoiceAdminApi";
import { formatCurrency, formatDate } from "../../lib/format";
import { openPrintWindow } from "../../lib/print";
import InvoiceStatusBadge from "../../components/invoices/InvoiceStatusBadge";
import RecordPaymentModal from "../../components/invoices/RecordPaymentModal";
import ConfirmActionModal from "../../components/invoices/ConfirmActionModal";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  Skeleton,
} from "../../components/ui";

const PAYMENT_METHOD_LABELS = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CARD: "Card",
  RAZORPAY: "Razorpay",
  OTHER: "Other",
};

function Detail({ label, value, mono = false }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm text-ink ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function TotalRow({ label, value, tone = "default", emphasis = false }) {
  const toneClass = {
    default: "text-body",
    danger: "text-danger",
    success: "text-success",
    ink: "text-ink",
  }[tone];

  return (
    <div
      className={`flex items-center justify-between ${emphasis ? "border-t border-line pt-3 text-base" : "text-sm"}`}
    >
      <span className={emphasis ? "font-semibold text-ink" : "text-body"}>{label}</span>
      <span className={`${emphasis ? "font-semibold" : "font-medium"} ${toneClass}`}>{value}</span>
    </div>
  );
}

export default function CompanyAdminInvoiceDetail({ invoiceId, onBack, onEdit }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, action: null, title: "", message: "" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await getInvoiceById(invoiceId);
        if (cancelled) return;
        if (res.success) setInvoice(res.data);
        else setError("Invoice not found.");
      } catch {
        if (!cancelled) setError("Failed to load invoice details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const reload = async () => {
    const res = await getInvoiceById(invoiceId);
    if (res.success) setInvoice(res.data);
  };

  const handleAction = async (action) => {
    try {
      await handleInvoiceStatusAction(invoiceId, action);
      setNotice(action === "send" ? "Invoice sent to the customer." : "Invoice cancelled.");
      await reload();
    } catch (err) {
      setNotice(err.response?.data?.message || "Action failed.");
    }
  };

  const handleRecordPayment = async (payload) => {
    await recordInvoicePayment(invoiceId, payload);
    setNotice("Payment recorded.");
    await reload();
  };

  // The backend renders a complete, self-contained print document for the
  // invoice. Pulling it through the authenticated api client and writing it into
  // a new tab matches how the Bills page prints.
  const handlePrint = async () => {
    try {
      setPrinting(true);
      setNotice("");
      const html = await getInvoicePrintHtml(invoiceId);
      if (!openPrintWindow(html)) {
        setNotice("Please allow popups to print this invoice.");
      }
    } catch (err) {
      setNotice(err.response?.data?.message || "Could not build the invoice document.");
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardBody className="space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <>
        <PageHeader title="Invoice" actions={<Button variant="secondary" onClick={onBack}>Back</Button>} />
        <Alert tone="error" title="Could not load this invoice">
          {error || "Invoice not found."}
        </Alert>
      </>
    );
  }

  const canRecordPayment = ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status);
  const canCancel = invoice.status !== "PAID" && invoice.status !== "CANCELLED";

  const paymentColumns = [
    {
      key: "paymentDate",
      header: "Date",
      render: (row) => formatDate(row.paymentDate),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (row) => <span className="font-medium text-success">{formatCurrency(row.amount)}</span>,
    },
    {
      key: "method",
      header: "Method",
      render: (row) => PAYMENT_METHOD_LABELS[row.method] || row.method,
    },
    {
      key: "reference",
      header: "Reference",
      render: (row) => row.reference || <span className="text-muted">—</span>,
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
        title={invoice.invoiceNumber}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{invoice.customer?.name}</span>
            <span className="text-line-strong">·</span>
            <span>Issued {formatDate(invoice.invoiceDate)}</span>
            <InvoiceStatusBadge status={invoice.status} />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            <Button variant="secondary" onClick={handlePrint} loading={printing}>
              {!printing && <Printer className="h-4 w-4" aria-hidden="true" />}
              Print
            </Button>
            {invoice.status === "DRAFT" && (
              <>
                <Button variant="secondary" onClick={() => onEdit(invoiceId)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Button>
                <Button onClick={() => handleAction("send")}>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Send to customer
                </Button>
              </>
            )}
            {canRecordPayment && (
              <Button onClick={() => setPaymentOpen(true)}>
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Record payment
              </Button>
            )}
            {canCancel && (
              <Button
                variant="danger-soft"
                onClick={() =>
                  setConfirm({
                    open: true,
                    action: () => handleAction("cancel"),
                    title: "Cancel invoice",
                    message:
                      "Are you sure you want to cancel this invoice? This cannot be undone and the customer will see it as cancelled.",
                  })
                }
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                Cancel invoice
              </Button>
            )}
          </>
        }
      />

      {notice && (
        <Alert className="mb-4" tone="success">
          {notice}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Left: parties + line items + notes */}
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardBody className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">From</h3>
                <p className="text-sm font-semibold text-ink">{invoice.company?.name}</p>
                {invoice.company?.address && (
                  <p className="mt-0.5 whitespace-pre-line text-sm text-body">{invoice.company.address}</p>
                )}
                {invoice.company?.gstNumber && (
                  <p className="mt-1 font-mono text-xs text-muted">GSTIN: {invoice.company.gstNumber}</p>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Bill to</h3>
                <p className="text-sm font-semibold text-ink">{invoice.customer?.name}</p>
                <p className="mt-0.5 text-sm text-body">{invoice.customer?.email}</p>
                {invoice.customer?.phoneNumber && (
                  <p className="text-sm text-body">{invoice.customer.phoneNumber}</p>
                )}
                {invoice.customer?.addresses?.find((address) => address.type === "BILLING")?.line1 && (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted">
                    {invoice.customer.addresses
                      .filter((address) => address.type === "BILLING")
                      .map((address) =>
                        [address.line1, address.city, address.state, address.country, address.postalCode]
                          .filter(Boolean)
                          .join(", ")
                      )
                      .join("\n")}
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Line items" description={`${invoice.items?.length || 0} line(s) on this invoice`} />
            <DataTable
              contained
              columns={[
                {
                  key: "description",
                  header: "Description",
                  render: (row) => (
                    <div>
                      <div className="font-medium text-ink">{row.description}</div>
                      <div className="text-xs uppercase text-muted">{row.itemType}</div>
                    </div>
                  ),
                },
                {
                  key: "quantity",
                  header: "Qty",
                  align: "right",
                  render: (row) => Number(row.quantity),
                },
                {
                  key: "unitPrice",
                  header: "Price",
                  align: "right",
                  render: (row) => formatCurrency(row.unitPrice),
                },
                {
                  key: "taxRate",
                  header: "Tax / disc.",
                  align: "right",
                  render: (row) => (
                    <div>
                      <div>{Number(row.taxRate) || 0}%</div>
                      {Number(row.discount) > 0 && (
                        <div className="text-xs text-muted">-{formatCurrency(row.discount)}</div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "lineTotal",
                  header: "Line total",
                  align: "right",
                  render: (row) => <span className="font-medium text-ink">{formatCurrency(row.lineTotal)}</span>,
                },
              ]}
              rows={invoice.items || []}
            />
          </Card>

          {(invoice.notes || invoice.termsAndConditions) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {invoice.notes && (
                <Card>
                  <CardHeader title="Internal notes" description="Not shown to the customer." />
                  <CardBody>
                    <p className="whitespace-pre-line text-sm text-body">{invoice.notes}</p>
                  </CardBody>
                </Card>
              )}
              {invoice.termsAndConditions && (
                <Card>
                  <CardHeader title="Terms & conditions" />
                  <CardBody>
                    <p className="whitespace-pre-line text-sm text-body">{invoice.termsAndConditions}</p>
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Right: totals + payments */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Summary" />
            <CardBody className="space-y-2.5">
              <div className="grid grid-cols-2 gap-4 border-b border-line pb-4">
                <Detail label="Issue date" value={formatDate(invoice.invoiceDate)} />
                <Detail label="Due date" value={formatDate(invoice.dueDate)} />
                <Detail label="Currency" value={invoice.currency} />
                <Detail label="Status" value={<InvoiceStatusBadge status={invoice.status} />} />
              </div>

              <div className="space-y-2.5 pt-1">
                <TotalRow label="Subtotal" value={formatCurrency(invoice.subtotal)} />
                <TotalRow label="Discount" value={`-${formatCurrency(invoice.discountTotal)}`} tone="danger" />
                <TotalRow label="Tax" value={formatCurrency(invoice.taxTotal)} />
                <TotalRow label="Grand total" value={formatCurrency(invoice.grandTotal)} tone="ink" emphasis />
                <TotalRow label="Paid" value={formatCurrency(invoice.amountPaid)} tone="success" />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-body">Amount due</span>
                <span
                  className={`text-xl font-semibold ${
                    Number(invoice.amountDue) > 0 ? "text-danger" : "text-success"
                  }`}
                >
                  {formatCurrency(invoice.amountDue)}
                </span>
              </div>

              {canRecordPayment && (
                <Button className="w-full justify-center" onClick={() => setPaymentOpen(true)}>
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                  Record payment
                </Button>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Payment history"
              description={`${invoice.payments?.length || 0} payment(s) recorded`}
            />
            <DataTable
              contained
              columns={paymentColumns}
              rows={invoice.payments || []}
              empty={
                <EmptyState
                  compact
                  icon={Wallet}
                  title="No payments yet"
                  description="Payments recorded against this invoice will appear here."
                />
              }
            />
          </Card>
        </div>
      </div>

      {paymentOpen && (
        <RecordPaymentModal
          isOpen
          onClose={() => setPaymentOpen(false)}
          invoice={invoice}
          onRecord={handleRecordPayment}
        />
      )}

      <ConfirmActionModal
        isOpen={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onConfirm={confirm.action}
        title={confirm.title}
        message={confirm.message}
        confirmText="Cancel invoice"
        confirmVariant="red"
      />
    </>
  );
}
