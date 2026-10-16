import { useState } from "react";
import { formatCurrency } from "../../lib/format";
import { Button, Input, Modal, Select } from "../ui";

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "RAZORPAY", label: "Razorpay" },
  { value: "OTHER", label: "Other" },
];

export default function RecordPaymentModal({ isOpen, onClose, invoice, onRecord }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amount: invoice?.amountDue || 0,
    method: "BANK_TRANSFER",
    paymentDate: new Date().toISOString().split("T")[0],
    reference: "",
  });

  if (!isOpen) return null;

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (amount > Number(invoice.amountDue)) {
      setError("Amount cannot be more than the outstanding balance.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onRecord(form);
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
      description="Payments are matched against this invoice's outstanding balance."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="record-payment-form" loading={loading}>
            {loading ? "Recording…" : "Record payment"}
          </Button>
        </>
      }
    >
      <form id="record-payment-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && (
          <div className="rounded-control border border-danger-line bg-danger-soft px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between rounded-tile border border-primary-100 bg-primary-50/50 px-4 py-3">
          <span className="text-sm text-body">Outstanding balance</span>
          <span className="text-lg font-semibold text-ink">{formatCurrency(invoice.amountDue)}</span>
        </div>

        <Input
          label="Amount paid"
          type="number"
          step="0.01"
          required
          prefix="₹"
          value={form.amount}
          onChange={(e) => setField("amount", e.target.value)}
          error={error.startsWith("Amount") ? error : ""}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Method"
            required
            value={form.method}
            onChange={(e) => setField("method", e.target.value)}
            options={METHODS}
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
      </form>
    </Modal>
  );
}
