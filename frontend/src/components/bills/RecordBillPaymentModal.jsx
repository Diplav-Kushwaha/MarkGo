import { useState } from "react";
import { formatCurrency, humanize } from "../../lib/format";
import { Button, Input, Modal, Select } from "../ui";

const METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
  { value: "RAZORPAY", label: "Razorpay" },
  { value: "STRIPE", label: "Stripe" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "CASHFREE", label: "Cashfree" },
  { value: "OTHER", label: "Other" },
];

export default function RecordBillPaymentModal({ isOpen, onClose, bill, onRecord }) {
  // Mounted only while open, so the initial amount is the balance at open time.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amount: bill?.amountDue || 0,
    method: "BANK_TRANSFER",
    paymentDate: new Date().toISOString().split("T")[0],
    reference: "",
    note: "",
  });

  if (!isOpen) return null;

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (amount > Number(bill.amountDue) + 0.009) {
      setError("Amount cannot exceed the outstanding balance.");
      return;
    }

    try {
      setLoading(true);
      await onRecord({ ...form, amount });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title="Record payment"
      description="Payments are matched against this bill's outstanding balance."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="record-bill-payment-form" loading={loading}>
            {loading ? "Recording…" : "Record payment"}
          </Button>
        </>
      }
    >
      <form id="record-bill-payment-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="flex items-center justify-between rounded-tile border border-primary-100 bg-primary-50/50 px-4 py-3">
          <span className="text-sm text-body">Outstanding balance</span>
          <span className="text-lg font-semibold text-ink">{formatCurrency(bill.amountDue)}</span>
        </div>

        {error && (
          <div className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Input
          label="Amount paid"
          type="number"
          step="0.01"
          min="0"
          max={bill.amountDue}
          required
          prefix="₹"
          value={form.amount}
          onChange={(e) => setField("amount", e.target.value)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Method"
            required
            value={form.method}
            onChange={(e) => setField("method", e.target.value)}
            options={METHOD_OPTIONS.map((method) => ({
              value: method.value,
              label: method.label || humanize(method.value),
            }))}
          />
          <Input
            label="Payment date"
            type="date"
            required
            value={form.paymentDate}
            onChange={(e) => setField("paymentDate", e.target.value)}
          />
        </div>

        <Input
          label="Reference / transaction ID"
          value={form.reference}
          onChange={(e) => setField("reference", e.target.value)}
          placeholder="e.g. TXN12345678"
        />

        <Input
          label="Note"
          value={form.note}
          onChange={(e) => setField("note", e.target.value)}
          placeholder="Optional internal note"
        />
      </form>
    </Modal>
  );
}
