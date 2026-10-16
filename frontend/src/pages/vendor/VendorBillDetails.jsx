import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { getVendorBillById } from "../../api/vendorDashboardApi";
import { formatCurrency, formatDate } from "../../lib/format";
import { Alert, Button, Card, PageHeader, SkeletonText, StatusBadge } from "../../components/ui";

/**
 * Read-only bill detail for the logged-in vendor. The backend 404s any id that
 * is not this vendor's own bill, so a wrong id simply shows "not found". No
 * download / pay / approve / edit controls — the layout is printable-looking.
 *
 * Note: the Bill model stores only a single `total` (plus amountPaid and
 * amountDue); it has no separate subtotal, tax or discount columns today, so
 * none are shown here.
 */
export default function VendorBillDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getVendorBillById(id);
      if (res.success && res.data) setBill(res.data);
      else setError("Bill not found.");
    } catch (err) {
      if (err.response?.status === 404) setError("Bill not found.");
      else setError(err.response?.data?.message || "Could not load this bill. Please try again.");
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
        <PageHeader title="Bill" />
        <Card>
          <SkeletonText lines={12} className="p-6" />
        </Card>
      </>
    );
  }

  if (error || !bill) {
    return (
      <>
        <PageHeader title="Bill">
          <div className="mt-4">
            <Button variant="secondary" onClick={() => navigate("/vendor/dashboard/bills")}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to bills
            </Button>
          </div>
        </PageHeader>
        <Alert tone="error" title="Cannot show this bill">
          {error || "Bill not found."}
        </Alert>
      </>
    );
  }

  const currency = bill.currency || bill.company?.currency || "INR";
  const company = bill.company || {};
  const money = (value) => formatCurrency(value, currency);

  return (
    <>
      <PageHeader
        title={`Bill ${bill.billNumber}`}
        actions={
          <Button variant="secondary" onClick={() => navigate("/vendor/dashboard/bills")}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Button>
        }
      />

      <Card>
        <div className="space-y-8 p-6 sm:p-8">
          {/* Company + bill identity */}
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
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Bill</p>
              <p className="text-base font-semibold text-ink">{bill.billNumber}</p>
              {bill.category && <p className="mt-1 text-xs text-muted">Category: {bill.category}</p>}
              <div className="mt-2 flex sm:justify-end">
                <StatusBadge status={bill.status} dot />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-tile border border-primary-100 bg-primary-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Bill date</p>
              <p className="mt-1 font-medium text-ink">{formatDate(bill.billDate)}</p>
            </div>
            <div className="rounded-tile border border-primary-100 bg-primary-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Due date</p>
              <p className="mt-1 font-medium text-ink">{bill.dueDate ? formatDate(bill.dueDate) : "—"}</p>
            </div>
          </div>

          {/* Items */}
          <div className="overflow-x-auto rounded-tile border border-primary-100">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-primary-50/60">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-body">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-body">Description</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-body">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-body">Price</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-body">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2.5 text-muted">{index + 1}</td>
                    <td className="px-3 py-2.5 text-ink">{item.description}</td>
                    <td className="px-3 py-2.5 text-right text-body">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right text-body">{money(item.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-ink">{money(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <dl className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="font-semibold text-ink">{money(bill.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Paid</dt>
                <dd className="text-body">{money(bill.amountPaid)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-semibold text-ink">Balance due</dt>
                <dd className="font-semibold text-ink">{money(bill.amountDue)}</dd>
              </div>
            </dl>
          </div>

          <p className="text-xs text-muted">All amounts shown in {currency}.</p>
        </div>
      </Card>
    </>
  );
}
