import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { createBill, getBillById, updateBill } from "../../api/billAdminApi";
import { getVendors } from "../../api/vendorAdminApi";
import { getItems } from "../../api/itemAdminApi";
import BillStatusBadge from "../../components/bills/BillStatusBadge";
import { formatCurrency, humanize } from "../../lib/format";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormActionBar,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from "../../components/ui";

const CATEGORY_OPTIONS = [
  "OFFICE",
  "TRAVEL",
  "RENT",
  "UTILITIES",
  "SUPPLIES",
  "SERVICES",
  "SOFTWARE",
  "TAXES",
  "OTHER",
];

const emptyLine = () => ({ itemId: null, description: "", quantity: 1, unitPrice: 0 });
const toDateInput = (value) => (value ? String(value).split("T")[0] : "");

const emptyForm = () => ({
  vendorId: "",
  billDate: new Date().toISOString().split("T")[0],
  dueDate: "",
  category: "",
  notes: "",
  amount: "",
  lines: [emptyLine()],
});

export default function CompanyAdminBillForm({ billId, onBack, onSuccess }) {
  const isEdit = Boolean(billId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [readOnly, setReadOnly] = useState(false);
  const [loadedBill, setLoadedBill] = useState(null);

  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState("AMOUNT");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let active = true;

    getVendors({ pageSize: 100 })
      .then((res) => {
        if (active && res.success) setVendors(res.data.vendors || []);
      })
      .catch(() => {
        if (active) setVendors([]);
      });

    getItems({ pageSize: 100 })
      .then((res) => {
        if (active && res.success) setItems(res.data.items || []);
      })
      .catch(() => {
        if (active) setItems([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isEdit) return undefined;

    let active = true;

    getBillById(billId)
      .then((res) => {
        if (!active || !res.success) return;

        const bill = res.data;
        setLoadedBill(bill);

        // Once any payment exists the bill is locked against edits.
        if (bill.status !== "UNPAID" || bill.payments?.length > 0 || Number(bill.amountPaid) > 0) {
          setReadOnly(true);
        }

        const billItems = bill.items || [];
        setForm({
          vendorId: bill.vendor?.id || bill.vendorId || "",
          billDate: toDateInput(bill.billDate),
          dueDate: toDateInput(bill.dueDate),
          category: bill.category || "",
          notes: bill.notes || "",
          amount: billItems.length === 0 ? String(bill.total ?? 0) : "",
          lines: billItems.length
            ? billItems.map((item) => ({
                itemId: item.itemId || null,
                description: item.description || "",
                quantity: Number(item.quantity) || 0,
                unitPrice: Number(item.unitPrice) || 0,
              }))
            : [emptyLine()],
        });
        setMode(billItems.length ? "ITEMS" : "AMOUNT");
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
  }, [billId, isEdit]);

  const runningTotal = form.lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
    0
  );

  const setField = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => ({ ...previous, [key]: "" }));
    setError("");
  };

  const updateLine = (index, key, value) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)),
    }));
    setFieldErrors((previous) => ({ ...previous, [`line-${index}`]: "" }));
  };

  const handlePickItem = (index, item) => {
    setForm((previous) => ({
      ...previous,
      lines: previous.lines.map((line, i) =>
        i === index
          ? {
              ...line,
              itemId: item.id,
              description: line.description || item.name,
              unitPrice: Number(item.purchasePrice ?? item.salesPrice ?? line.unitPrice) || 0,
            }
          : line
      ),
    }));
  };

  const removeLine = (index) => {
    setForm((previous) => {
      if (previous.lines.length === 1) return previous;
      return { ...previous, lines: previous.lines.filter((_, i) => i !== index) };
    });
  };

  const validate = () => {
    const errors = {};
    if (!form.vendorId) errors.vendorId = "Please select a vendor.";
    if (!form.billDate) errors.billDate = "Bill date is required.";

    if (mode === "AMOUNT") {
      const amount = Number(form.amount);
      if (!form.amount || Number.isNaN(amount) || amount <= 0) {
        errors.amount = "Enter an amount greater than 0.";
      }
    } else {
      const filled = form.lines.filter((line) => (line.description || "").trim());
      if (filled.length === 0) errors.lines = "Add at least one line with a description.";

      form.lines.forEach((line, index) => {
        if (!(line.description || "").trim()) return;
        const price = Number(line.unitPrice);
        if (Number.isNaN(price) || price < 0) errors[`line-${index}`] = "Unit price cannot be negative.";
      });
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSaving(true);
      const base = {
        vendorId: form.vendorId,
        billDate: form.billDate,
        dueDate: form.dueDate || undefined,
        category: form.category || undefined,
        notes: form.notes || undefined,
      };

      // The API accepts either a single `amount` OR an `items` array, never both.
      const payload =
        mode === "AMOUNT"
          ? { ...base, amount: Number(form.amount) }
          : {
              ...base,
              items: form.lines
                .filter((line) => (line.description || "").trim())
                .map((line) => ({
                  itemId: line.itemId || undefined,
                  description: line.description,
                  quantity: Number(line.quantity) || 0,
                  unitPrice: Number(line.unitPrice) || 0,
                })),
            };

      const res = isEdit ? await updateBill(billId, payload) : await createBill(payload);
      if (res.success) onSuccess(res.data.id);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardBody className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </CardBody>
        </Card>
      </div>
    );
  }

  const total = mode === "AMOUNT" ? Number(form.amount) || 0 : runningTotal;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit bill${loadedBill ? ` · ${loadedBill.billNumber}` : ""}` : "New bill"}
        subtitle={
          isEdit
            ? "Update the vendor, amounts and category for this bill."
            : "Record a vendor bill as a single amount or as line items."
        }
        actions={
          <Button variant="secondary" onClick={onBack} disabled={saving}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to bills
          </Button>
        }
      />

      {isEdit && loadedBill && (
        <div className="mb-4 flex items-center gap-2">
          <BillStatusBadge status={loadedBill.status} />
          {readOnly && (
            <span className="text-sm text-muted">
              Locked — payments have been recorded against this bill.
            </span>
          )}
        </div>
      )}

      {readOnly && (
        <Alert className="mb-4" tone="info" title="This bill can no longer be edited">
          A payment has already been recorded against it. Settle or adjust the bill from the payments
          recorded on its detail page.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 pb-4">
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <Card>
              <CardHeader title="Vendor & entry mode" />
              <CardBody className="space-y-4">
                <Select
                  label="Vendor"
                  required
                  value={form.vendorId}
                  onChange={(e) => setField("vendorId", e.target.value)}
                  error={fieldErrors.vendorId}
                  placeholder="Select a vendor…"
                  options={vendors.map((vendor) => ({ value: vendor.id, label: vendor.name }))}
                  disabled={readOnly}
                />

                <div>
                  <span className="mb-1.5 block text-sm font-medium text-ink">Entry mode</span>
                  <div className="inline-flex rounded-lg border border-line bg-slate-50 p-1">
                    {[
                      { value: "AMOUNT", label: "Single amount" },
                      { value: "ITEMS", label: "Line items" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMode(option.value)}
                        disabled={readOnly}
                        aria-pressed={mode === option.value}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                          mode === option.value
                            ? "bg-surface text-ink shadow-sm"
                            : "text-muted hover:text-ink"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {mode === "AMOUNT" ? (
                  <Input
                    label="Amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    prefix="₹"
                    value={form.amount}
                    onChange={(e) => setField("amount", e.target.value)}
                    error={fieldErrors.amount}
                    disabled={readOnly}
                  />
                ) : (
                  <div className="space-y-3">
                    {form.lines.map((line, index) => {
                      const lineError = fieldErrors[`line-${index}`];
                      const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);

                      return (
                        <div
                          key={index}
                          className="space-y-3 rounded-lg border border-line bg-slate-50/60 p-3"
                        >
                          <div className="flex items-end gap-3">
                            <Select
                              label="Catalogue item"
                              value={line.itemId || ""}
                              onChange={(e) => {
                                const found = items.find((item) => String(item.id) === String(e.target.value));
                                handlePickItem(index, found || { id: e.target.value, name: line.description });
                              }}
                              placeholder="Optional"
                              options={items.map((item) => ({ value: item.id, label: item.name }))}
                              disabled={readOnly}
                              containerClassName="flex-1"
                            />
                            <Input
                              label="Qty"
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.quantity}
                              onChange={(e) => updateLine(index, "quantity", e.target.value)}
                              disabled={readOnly}
                              containerClassName="w-24"
                            />
                            <Input
                              label="Unit price"
                              type="number"
                              step="0.01"
                              min="0"
                              prefix="₹"
                              value={line.unitPrice}
                              onChange={(e) => updateLine(index, "unitPrice", e.target.value)}
                              error={lineError}
                              disabled={readOnly}
                              containerClassName="w-40"
                            />
                            <div className="pb-1 text-right text-sm font-semibold text-ink">
                              {formatCurrency(lineTotal)}
                            </div>
                          </div>

                          <div className="flex items-end gap-3">
                            <Input
                              label="Description"
                              value={line.description}
                              onChange={(e) => updateLine(index, "description", e.target.value)}
                              placeholder="What is this bill for?"
                              disabled={readOnly}
                              containerClassName="flex-1"
                            />
                            <Button
                              type="button"
                              variant="danger-ghost"
                              size="icon"
                              onClick={() => removeLine(index)}
                              disabled={readOnly || form.lines.length === 1}
                              aria-label={`Remove line ${index + 1}`}
                              className="mb-0.5"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setForm((previous) => ({ ...previous, lines: [...previous.lines, emptyLine()] }))}
                      disabled={readOnly}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Add line
                    </Button>

                    {fieldErrors.lines && <p className="text-xs text-danger">{fieldErrors.lines}</p>}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Notes" description="Internal notes about this bill." />
              <CardBody>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Reference numbers, approval context…"
                  disabled={readOnly}
                />
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Bill details" />
              <CardBody className="space-y-4">
                <Input
                  label="Bill date"
                  type="date"
                  required
                  value={form.billDate}
                  onChange={(e) => setField("billDate", e.target.value)}
                  error={fieldErrors.billDate}
                  disabled={readOnly}
                />
                <Input
                  label="Due date"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setField("dueDate", e.target.value)}
                  disabled={readOnly}
                />
                <Select
                  label="Category"
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                  placeholder="Select a category…"
                  options={CATEGORY_OPTIONS.map((category) => ({
                    value: category,
                    label: humanize(category),
                  }))}
                  disabled={readOnly}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Summary" />
              <CardBody>
                <div className="flex items-center justify-between border-t border-line pt-3 text-base font-semibold text-ink">
                  <span>{mode === "AMOUNT" ? "Amount" : "Line total"}</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        <FormActionBar>
          <Button type="button" variant="secondary" onClick={onBack} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={readOnly}>
            {!saving && <Save className="h-4 w-4" aria-hidden="true" />}
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create bill"}
          </Button>
        </FormActionBar>
      </form>
    </>
  );
}
