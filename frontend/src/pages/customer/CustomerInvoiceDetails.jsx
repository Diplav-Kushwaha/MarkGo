import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { getCustomerInvoiceById } from "../../api/customerDashboardApi";
import { formatCurrency, formatDate } from "../../lib/format";
import { Alert, Button, Card, PageHeader, SkeletonText, StatusBadge } from "../../components/ui";

/**
 * Read-only invoice detail for the logged-in customer. The backend 404s any id
 * that is not this customer's own invoice, so a wrong id simply shows "not
 * found". No download / pay / edit / action controls — the layout is printable.
 */
export default function CustomerInvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getCustomerInvoiceById(id);
      if (res.success && res.data) setInvoice(res.data);
      else setError("Invoice not found.");
    } catch (err) {
      if (err.response?.status === 404) setError("Invoice not found.");
      else setError(err.response?.data?.message || "Could not load this invoice. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  if (loading) {
    return (
      <>
        <PageHeader title="Invoice" />
        <Card>
          <SkeletonText lines={12} className="p-6" />
        </Card>
      </>
    );
  }

  if (error || !invoice) {
    return (
      <>
        <PageHeader title="Invoice">
          <div className="mt-4">
            <Button variant="secondary" onClick={() => navigate("/customer/dashboard/invoices")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to invoices
            </Button>
          </div>
        </PageHeader>
        <Alert tone="error" title="Cannot show this invoice">
          {error || "Invoice not found."}
        </Alert>
      </>
    );
  }

  const currency = invoice.currency || invoice.company?.currency || "INR";
  const company = invoice.company || {};
  const customer = invoice.customer || {};
  const money = (value) => formatCurrency(value, currency);

  return (
    <>
      <PageHeader
        title={`Invoice ${invoice.invoiceNumber}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/customer/dashboard/invoices")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Button>
            <Button variant="primary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print
            </Button>
          </div>
        }
      />

      <Card>
        <div className="space-y-8 p-6 sm:p-8">
          {/* Company + invoice identity */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">{company.name || "—"}</h2>
              {company.address && <p className="text-sm text-body">{company.address}</p>}
              {(company.city || company.country) && (
                <p className="text-sm text-body">{[company.city, company.country].filter(Boolean).join(", ")}</p>
              )}
              {company.gstNumber && <p className="mt-1 text-sm text-muted">GSTIN: {company.gstNumber}</p>}
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Invoice</p>
              <p className="text-base font-semibold text-ink">{invoice.invoiceNumber}</p>
              <div className="mt-2 flex sm:justify-end">
                <StatusBadge status={invoice.status} dot />
              </div>
            </div>
          </div>

          {/* Bill to + dates */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-tile border border-primary-100 bg-primary-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Billed to</p>
              <p className="mt-1 font-medium text-ink">{customer.name || "—"}</p>
              {customer.companyName && <p className="text-sm text-body">{customer.companyName}</p>}
              {customer.email && <p className="text-sm text-body">{customer.email}</p>}
              {customer.phoneNumber && <p className="text-sm text-body">{customer.phoneNumber}</p>}
              {customer.taxNumber && <p className="text-sm text-muted">Tax ID: {customer.taxNumber}</p>}
            </div>
            <div className="rounded-tile border border-primary-100 bg-primary-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Details</p>
              <div className="mt-1 space-y-1 text-sm">
                <p className="text-body">
                  Issue date: <span className="font-medium text-ink">{formatDate(invoice.invoiceDate)}</span>
                </p>
                <p className="text-body">
                  Due date: <span className="font-medium text-ink">{formatDate(invoice.dueDate)}</span>
                </p>
                <p className="text-body">
                  Amount due: <span className="font-semibold text-ink">{money(invoice.amountDue)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="overflow-x-auto rounded-tile border border-primary-100">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-primary-50/60">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-body">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-body">Description</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-body">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-body">Price</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-body">Tax</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-body">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2.5 text-muted">{index + 1}</td>
                    <td className="px-3 py-2.5 text-ink">{item.description}</td>
                    <td className="px-3 py-2.5 text-right text-body">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-body">{money(item.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-right text-body">{item.taxRate}%</td>
                    <td className="px-3 py-2.5 text-right font-medium text-ink">{money(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="text-body">{money(invoice.subtotal)}</dd>
              </div>
              {Number(invoice.discountTotal) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Discount</dt>
                  <dd className="text-body">- {money(invoice.discountTotal)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Tax</dt>
                <dd className="text-body">{money(invoice.taxTotal)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="font-semibold text-ink">{money(invoice.grandTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Paid</dt>
                <dd className="text-body">{money(invoice.amountPaid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-ink">Balance due</dt>
                <dd className="font-semibold text-ink">{money(invoice.amountDue)}</dd>
              </div>
            </dl>
          </div>

          {(invoice.notes || invoice.termsAndConditions) && (
            <div className="space-y-3 border-t border-line pt-4 text-sm">
              {invoice.notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-body">{invoice.notes}</p>
                </div>
              )}
              {invoice.termsAndConditions && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Terms &amp; conditions</p>
                  <p className="mt-1 whitespace-pre-wrap text-body">{invoice.termsAndConditions}</p>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted">All amounts shown in {currency}.</p>
        </div>
      </Card>
    </>
  );
}
