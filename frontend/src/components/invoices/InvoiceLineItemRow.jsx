import { Trash2 } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import ProductServicePickerField from "./ProductServicePickerField";

// Column widths are declared in the <colgroup> in CompanyAdminInvoiceForm. The
// inputs only need to fill whatever width their cell is given.
const CELL =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors " +
  "placeholder:text-muted focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50";

// Right-aligned, spinner-free numeric cells so values like 125000.50 stay
// readable instead of being clipped by the browser's stepper arrows.
const NUMBER_CELL = `${CELL} no-spinner text-right`;

export default function InvoiceLineItemRow({ index, item, onChange, onRemove, disabled }) {
  const handleChange = (field, value) => {
    onChange(index, { ...item, [field]: value });
  };

  const handleItemSelect = (dbItem) => {
    onChange(index, {
      ...item,
      itemId: dbItem.id,
      description: dbItem.name,
      unitPrice: Number(dbItem.salesPrice),
      taxRate: Number(dbItem.taxRate),
    });
  };

  const lineTotal =
    (Number(item.quantity) * Number(item.unitPrice) - Number(item.discount)) *
    (1 + Number(item.taxRate) / 100) || 0;

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-3 pr-2 align-top">
        <select
          value={item.itemType}
          onChange={(e) => handleChange("itemType", e.target.value)}
          disabled={disabled}
          aria-label={`Item type for line ${index + 1}`}
          className={`${CELL} cursor-pointer`}
        >
          <option value="PRODUCT">Product</option>
          <option value="SERVICE">Service</option>
        </select>
      </td>

      <td className="px-2 py-3 align-top">
        <ProductServicePickerField
          type={item.itemType}
          value={item.description}
          onChange={handleItemSelect}
          disabled={disabled}
        />
        <textarea
          value={item.description}
          onChange={(e) => handleChange("description", e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="Description shown on the invoice…"
          aria-label={`Description for line ${index + 1}`}
          className="mt-1.5 min-h-20 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-5 text-ink transition-colors placeholder:text-muted focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </td>

      <td className="px-2 py-3 align-top">
        <input
          type="number"
          min="1"
          step="0.01"
          value={item.quantity}
          onChange={(e) => handleChange("quantity", e.target.value)}
          disabled={disabled}
          aria-label={`Quantity for line ${index + 1}`}
          className={NUMBER_CELL}
        />
      </td>

      <td className="px-2 py-3 align-top">
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.unitPrice}
          onChange={(e) => handleChange("unitPrice", e.target.value)}
          disabled={disabled}
          aria-label={`Unit price for line ${index + 1}`}
          className={NUMBER_CELL}
        />
      </td>

      <td className="px-2 py-3 align-top">
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={item.taxRate}
          onChange={(e) => handleChange("taxRate", e.target.value)}
          disabled={disabled}
          aria-label={`Tax rate for line ${index + 1}`}
          className={NUMBER_CELL}
        />
      </td>

      <td className="px-2 py-3 align-top">
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.discount}
          onChange={(e) => handleChange("discount", e.target.value)}
          disabled={disabled}
          aria-label={`Discount for line ${index + 1}`}
          className={NUMBER_CELL}
        />
      </td>

      <td className="py-3 pl-2 text-right align-top">
        <span className="block whitespace-nowrap pt-2.5 text-sm font-semibold text-ink">
          {formatCurrency(lineTotal)}
        </span>
      </td>

      <td className="py-3 pl-2 pr-4 text-center align-top">
        {!disabled && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={`Remove line ${index + 1}`}
            className="mt-1.5 rounded-lg p-2 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </td>
    </tr>
  );
}
