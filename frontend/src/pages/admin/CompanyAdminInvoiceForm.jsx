import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Send } from "lucide-react";
import {
  createInvoice,
  getInvoiceById,
  handleInvoiceStatusAction,
  updateInvoice,
} from "../../api/invoiceAdminApi";
import { formatCurrency } from "../../lib/format";
import CustomerPickerField from "../../components/invoices/CustomerPickerField";
import InvoiceLineItemRow from "../../components/invoices/InvoiceLineItemRow";
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormActionBar,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
} from "../../components/ui";

const emptyItem = () => ({
  itemType: "PRODUCT",
  itemId: null,
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxRate: 0,
  discount: 0,
});

const emptyForm = () => ({
  customerId: "",
  customerName: "",
  invoiceDate: new Date().toISOString().split("T")[0],
  dueDate: new Date(+new Date() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  notes: "",
  termsAndConditions: "",
  items: [emptyItem()],
  status: "DRAFT",
});

export default function CompanyAdminInvoiceForm({ invoiceId, onBack, onSuccess }) {
  const isEdit = Boolean(invoiceId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!isEdit) return undefined;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const res = await getInvoiceById(invoiceId);
        if (cancelled) return;

        if (res.success) {
          const inv = res.data;
          // Only drafts are editable — anything else belongs on the detail view.
          if (inv.status !== "DRAFT") {
            onSuccess(invoiceId);
            return;
          }

          setForm({
            customerId: inv.customerId,
            customerName: inv.customer?.name || "",
            invoiceDate: inv.invoiceDate.split("T")[0],
            dueDate: inv.dueDate.split("T")[0],
            notes: inv.notes || "",
            termsAndConditions: inv.termsAndConditions || "",
            items: inv.items.map((item) => ({
              ...item,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              taxRate: Number(item.taxRate),
              discount: Number(item.discount),
            })),
            status: inv.status,
          });
        }
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
  }, [invoiceId, isEdit, onSuccess]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;

    form.items.forEach((item) => {
      const lineBase = Number(item.quantity) * Number(item.unitPrice);
      const lineDiscount = Number(item.discount);
      const lineTax = (lineBase - lineDiscount) * (Number(item.taxRate) / 100);
      subtotal += lineBase;
      discount += lineDiscount;
      tax += lineTax;
    });

    return { subtotal, discountTotal: discount, taxTotal: tax, grandTotal: subtotal - discount + tax };
  }, [form.items]);

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
  };

  const handleItemChange = (index, nextItem) => {
    setForm((previous) => {
      const items = [...previous.items];
      items[index] = nextItem;
      return { ...previous, items };
    });
    setError("");
  };

  const handleRemoveItem = (index) => {
    setForm((previous) => {
      if (previous.items.length === 1) return previous;
      return { ...previous, items: previous.items.filter((_, i) => i !== index) };
    });
  };

  const validate = () => {
    if (!form.customerId) return "Please select a customer.";
    if (!form.invoiceDate) return "Please choose an issue date.";
    if (!form.dueDate) return "Please choose a due date.";
    if (form.items.length === 0) return "Add at least one line item.";

    const hasContent = form.items.some(
      (item) => item.description.trim() || Number(item.quantity) > 0 || Number(item.unitPrice) > 0
    );
    if (!hasContent) return "Add at least one line item with a description or amount.";

    if (form.items.some((item) => Number(item.quantity) <= 0)) {
      return "Every line item needs a quantity greater than zero.";
    }
    if (form.items.some((item) => Number(item.taxRate) < 0 || Number(item.taxRate) > 100)) {
      return "Tax rate must be between 0 and 100.";
    }

    return "";
  };

  const handleSubmit = async (e, saveAndSend = false) => {
    e.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    if (saveAndSend) setSending(true);
    else setSaving(true);
    setError("");

    try {
      const payload = {
        ...form,
        items: form.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          discount: Number(item.discount),
        })),
      };

      const res = isEdit ? await updateInvoice(invoiceId, payload) : await createInvoice(payload);

      if (res.success) {
        if (saveAndSend) await handleInvoiceStatusAction(res.data.id, "send");
        onSuccess(res.data.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong while saving the invoice.");
    } finally {
      setSaving(false);
      setSending(false);
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

  return (
    <>
      <PageHeader
        title={isEdit ? "Edit invoice" : "New invoice"}
        subtitle={
          isEdit
            ? "Draft invoices can be edited until they are sent to the customer."
            : "Only draft invoices can be edited after saving."
        }
        actions={
          <Button variant="secondary" onClick={onBack} disabled={saving || sending}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to invoices
          </Button>
        }
      />

      <form onSubmit={(e) => handleSubmit(e)} className="space-y-4 pb-4">
        {error && (
          <Alert tone="error" title="Fix the following before saving">
            {error}
          </Alert>
        )}

        {/* The items table needs ~1000px. The side column only appears once the
            viewport is wide enough to hold both, so on a 1366/1440 laptop the
            table gets the full width instead of forcing a horizontal scroll. */}
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
          {/* Line items */}
          <Card className="2xl:col-span-2">
            <CardHeader
              title="Line items"
              description="Pick a catalogue item to fill price and tax, or type a description manually."
              actions={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setForm((previous) => ({ ...previous, items: [...previous.items, emptyItem()] }))}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add line
                </Button>
              }
            />

            <CardBody className="p-0">
              {/* min-w matches the colgroup widths so the table scrolls rather
                  than squeezing the inputs on a narrow card. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] table-fixed border-collapse">
                  <colgroup>
                    <col className="w-[110px]" />
                    <col />
                    <col className="w-[90px]" />
                    <col className="w-[130px]" />
                    <col className="w-[100px]" />
                    <col className="w-[110px]" />
                    <col className="w-[130px]" />
                    <col className="w-[48px]" />
                  </colgroup>
                  <thead className="border-b border-line bg-primary-50/60">
                    <tr>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-body">
                        Type
                      </th>
                      <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-body">
                        Item &amp; description
                      </th>
                      <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-body">
                        Qty
                      </th>
                      <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-body">
                        Price
                      </th>
                      <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-body">
                        Tax %
                      </th>
                      <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-body">
                        Discount
                      </th>
                      <th className="px-2 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-body">
                        Line total
                      </th>
                      <th className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-body">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, index) => (
                      <InvoiceLineItemRow
                        key={index}
                        index={index}
                        item={item}
                        onChange={handleItemChange}
                        onRemove={handleRemoveItem}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Dates + totals */}
          <div className="space-y-4">
            <Card>
              <CardHeader title="Customer & dates" />
              <CardBody className="space-y-4">
                <CustomerPickerField
                  value={form.customerId}
                  onChange={(customer) =>
                    setForm((previous) => ({
                      ...previous,
                      customerId: customer.id,
                      customerName: customer.name,
                    }))
                  }
                  error={error.startsWith("Please select a customer") ? "Select a customer" : ""}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-1">
                  <Input
                    label="Issue date"
                    type="date"
                    required
                    value={form.invoiceDate}
                    onChange={(e) => setField("invoiceDate", e.target.value)}
                  />
                  <Input
                    label="Due date"
                    type="date"
                    required
                    value={form.dueDate}
                    onChange={(e) => setField("dueDate", e.target.value)}
                  />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Summary" />
              <CardBody className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-body">
                  <span>Subtotal</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-body">
                  <span>Discount</span>
                  <span className="text-danger">-{formatCurrency(totals.discountTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-body">
                  <span>Tax</span>
                  <span>{formatCurrency(totals.taxTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3 text-base font-semibold text-ink">
                  <span>Grand total</span>
                  <span>{formatCurrency(totals.grandTotal)}</span>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Internal notes" description="Visible to your team only." />
            <CardBody>
              <Textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Private notes for internal use…"
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Terms & conditions" description="Shown to the customer." />
            <CardBody>
              <Textarea
                rows={4}
                value={form.termsAndConditions}
                onChange={(e) => setField("termsAndConditions", e.target.value)}
                placeholder="Payment terms, late fee policy…"
              />
            </CardBody>
          </Card>
        </div>

        <FormActionBar>
          <Button type="button" variant="secondary" onClick={onBack} disabled={saving || sending}>
            Cancel
          </Button>
          <Button type="submit" variant="secondary" loading={saving} disabled={sending}>
            {!saving && <Save className="h-4 w-4" aria-hidden="true" />}
            {saving ? "Saving…" : "Save as draft"}
          </Button>
          <Button type="button" loading={sending} disabled={saving} onClick={(e) => handleSubmit(e, true)}>
            {!sending && <Send className="h-4 w-4" aria-hidden="true" />}
            {sending ? "Sending…" : "Save & send"}
          </Button>
        </FormActionBar>
      </form>
    </>
  );
}
