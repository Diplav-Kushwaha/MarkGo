import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Eye,
  Package,
  Pencil,
  Plus,
  Power,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  createProduct,
  deleteProduct,
  getProductSummary,
  getProducts,
  updateProduct,
  updateProductStatus,
} from "../../api/productAdminApi";
import { getCategoryOptions } from "../../api/categoryAdminApi";
import { getUnitOptions } from "../../api/unitAdminApi";
import { formatCurrency } from "../../lib/format";
import { LOW_STOCK_THRESHOLD, PRODUCT_STATUS_LABELS, TAX_MODE_LABELS } from "../../lib/productConstants";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  RowActions,
  Skeleton,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import useDirectoryList from "../../components/admin/useDirectoryList";
import ProductFilterBar from "../../components/admin/ProductFilterBar";
import ProductFormModal from "../../components/admin/ProductFormModal";
import ProductDetailsDrawer from "../../components/admin/ProductDetailsDrawer";

/**
 * Products page for the new Products logic.
 *
 * Products used to share `ItemDirectoryPage` with Services through an `itemType`
 * prop. The product behaviour diverged far enough (summary cards, new filter
 * vocabulary, new form fields, Available/Not available labels) that it now lives
 * here, leaving `ItemDirectoryPage` serving exactly the Services behaviour it
 * always had. Unit and Category dropdowns are loaded from the Unit & Category
 * page's own option endpoints.
 */

const INITIAL_QUERY = {
  search: "",
  status: "",
  stock: "",
  sort: "newest",
  page: 1,
  pageSize: 10,
};

/** Adapts the product list response to the shape useDirectoryList expects. */
async function fetchPage(params) {
  const res = await getProducts(params);
  if (!res.success || !res.data) return null;
  return { rows: res.data.items || [], ...(res.data.pagination || {}) };
}

/** Company-wide product totals, unaffected by the list filters. */
async function fetchStats() {
  const res = await getProductSummary();
  if (!res.success || !res.data) return null;
  return res.data;
}

/** Loading placeholder that matches the five-card grid exactly. */
function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-card border border-primary-100/70 bg-white/95 p-5 shadow-card">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-10 rounded-tile" />
          </div>
          <Skeleton className="mt-4 h-7 w-32" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Small stock hint shown beside the quantity. */
function StockHint({ quantity }) {
  if (quantity <= 0) {
    return (
      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-danger-line">
        Out of stock
      </span>
    );
  }
  if (quantity <= LOW_STOCK_THRESHOLD) {
    return (
      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-warning-line">
        Low stock
      </span>
    );
  }
  return null;
}

export default function ProductDirectoryPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  // Dropdown options, shared by every open of the form.
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);

  const {
    query,
    rows,
    pagination,
    stats,
    loading,
    statsLoading,
    error,
    setFilter,
    setPage,
    setPageSize,
    resetFilters,
    reload,
  } = useDirectoryList({ fetchPage, fetchStats, initialQuery: INITIAL_QUERY });

  // Loading the units/categories here (rather than inside the modal) means a
  // second form open is instant, and the empty-state helper appears even before
  // the modal is opened.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getUnitOptions(), getCategoryOptions()])
      .then(([unitsRes, categoriesRes]) => {
        if (cancelled) return;
        setUnits(unitsRes.success ? unitsRes.data || [] : []);
        setCategories(categoriesRes.success ? categoriesRes.data || [] : []);
      })
      .catch(() => {
        if (cancelled) return;
        setUnits([]);
        setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setFormError("");
    setFormOpen(true);
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    setFormError("");
    setActionError("");
    try {
      if (editing) {
        await updateProduct(editing.id, payload);
        setNotice(`${payload.name} was updated.`);
      } else {
        await createProduct(payload);
        setNotice(`${payload.name} was added to your catalogue.`);
      }
      setFormOpen(false);
      // Reloads the list and the summary cards together.
      reload();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save this product.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (product) => {
    const nextStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setActionError("");
    setNotice("");
    try {
      await updateProductStatus(product.id, nextStatus);
      setNotice(`${product.name} is now ${PRODUCT_STATUS_LABELS[nextStatus]}.`);
      reload();
    } catch (err) {
      // The backend refuses Available when the quantity is 0; its message is
      // the clearest explanation, so it is surfaced verbatim.
      setActionError(err.response?.data?.message || "Failed to update this product's status.");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError("");
    setNotice("");
    try {
      await deleteProduct(pendingDelete.id);
      setNotice(`${pendingDelete.name} was removed from the catalogue.`);
      setPendingDelete(null);
      setFormOpen(false);
      setViewing(null);
      reload();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to delete this product.");
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const summaryCards = [
    {
      label: "Total Products",
      value: stats?.totalProducts ?? 0,
      hint: "Products in your catalogue",
      icon: Package,
      tone: "primary",
    },
    {
      label: "Available Products",
      value: stats?.availableProducts ?? 0,
      hint: "Currently offered for sale",
      icon: Boxes,
      tone: "success",
    },
    {
      label: "Low Stock Products",
      value: stats?.lowStockProducts ?? 0,
      hint: `Quantity of 1 to ${LOW_STOCK_THRESHOLD}`,
      icon: AlertTriangle,
      tone: "warning",
    },
    {
      label: "Total Selling Price",
      value: formatCurrency(stats?.totalSellingPrice ?? 0),
      hint: "Selling price × quantity on hand",
      icon: TrendingUp,
      tone: "info",
    },
    {
      label: "Total Cost",
      value: formatCurrency(stats?.totalCost ?? 0),
      hint: "Purchase price × quantity on hand",
      icon: Wallet,
      tone: "muted",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Product",
      render: (row) => (
        <div className="min-w-0">
          <div className="font-medium text-ink">{row.name}</div>
          {row.brand && <div className="text-xs text-muted">{row.brand}</div>}
        </div>
      ),
    },
    {
      key: "productCode",
      header: "Code",
      render: (row) => (row.productCode ? <span className="text-body">{row.productCode}</span> : <span className="text-muted">—</span>),
    },
    {
      key: "category",
      header: "Category",
      render: (row) =>
        row.categoryRef ? <span className="text-body">{row.categoryRef.name}</span> : <span className="text-muted">—</span>,
    },
    {
      key: "unit",
      header: "Unit",
      render: (row) =>
        row.unitRef ? (
          <span className="text-body">{row.unitRef.shortName || row.unitRef.name}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "sellingPrice",
      header: "Selling price",
      align: "right",
      render: (row) => (
        <div>
          <span className="font-medium text-ink">{formatCurrency(row.sellingPrice)}</span>
          <span className="ml-1 text-xs font-normal text-muted">
            {TAX_MODE_LABELS[row.sellingPriceTaxMode] || "no tax"}
          </span>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Quantity",
      align: "right",
      render: (row) => {
        const quantity = Number(row.quantity) || 0;
        return (
          <div className="flex items-center justify-end gap-2">
            <span className="text-body">{quantity}</span>
            <StockHint quantity={quantity} />
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge status={row.status} label={PRODUCT_STATUS_LABELS[row.status] || row.status} dot />
      ),
    },
    {
      key: "actions",
      header: "",
      width: "72px",
      align: "right",
      render: (row) => (
        <RowActions
          label={`Actions for ${row.name}`}
          actions={[
            { label: "View details", icon: Eye, onSelect: () => setViewing(row) },
            { label: "Edit", icon: Pencil, tone: "primary", onSelect: () => openEdit(row) },
            {
              label:
                row.status === "ACTIVE" ? "Mark Not available" : "Mark Available",
              icon: Power,
              onSelect: () => handleToggleStatus(row),
            },
            { label: "Delete", icon: Trash2, tone: "danger", onSelect: () => setPendingDelete(row) },
          ]}
        />
      ),
    },
  ];

  const hasFilters = Boolean(query.search || query.status || query.stock || query.sort !== INITIAL_QUERY.sort);

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Manage billable goods, inventory levels and GST tax codes."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Product
          </Button>
        }
      />

      <div className="space-y-4">
        {(error || notice || actionError) && (
          <Alert
            className="mb-4"
            tone={error || actionError ? "error" : "success"}
            title={error ? "Could not load the products" : actionError ? "Action failed" : undefined}
          >
            {error || actionError || notice}
          </Alert>
        )}

        {statsLoading ? (
          <SummaryCardsSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                hint={card.hint}
                icon={card.icon}
                tone={card.tone}
              />
            ))}
          </div>
        )}

        <ProductFilterBar
          searchValue={query.search}
          onSearchChange={(value) => setFilter("search", value.trim())}
          statusValue={query.status}
          onStatusChange={(value) => setFilter("status", value)}
          stockValue={query.stock}
          onStockChange={(value) => setFilter("stock", value)}
          sortValue={query.sort}
          onSortChange={(value) => setFilter("sort", value)}
          onReset={resetFilters}
        />

        <Card>
          <DataTable
            contained
            columns={columns}
            rows={rows}
            loading={loading}
            onRowClick={(row) => setViewing(row)}
            empty={
              <EmptyState
                icon={hasFilters ? Package : Plus}
                title={hasFilters ? "No products match these filters" : "Your catalogue is empty"}
                description={
                  hasFilters
                    ? "Try a different search term or clear the filters."
                    : "Add your first product to start invoicing."
                }
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Product
                  </Button>
                }
              />
            }
          />
        </Card>

        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {formOpen && (
        <ProductFormModal
          key={editing?.id || "new"}
          isOpen
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          product={editing}
          units={units}
          categories={categories}
          saving={saving}
          serverError={formError}
        />
      )}

      {viewing && (
        <ProductDetailsDrawer
          product={viewing}
          onClose={() => setViewing(null)}
          onEdit={(target) => {
            setViewing(null);
            openEdit(target);
          }}
        />
      )}

      {pendingDelete && (
        <Modal
          isOpen
          onClose={() => setPendingDelete(null)}
          size="sm"
          title="Delete product"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Delete product
              </Button>
            </>
          }
        >
          <p className="text-sm text-body">
            Remove <span className="font-medium text-ink">{pendingDelete.name}</span> from the catalogue?
            Past invoices keep their reference to this product, but it will no longer be selectable on
            new invoices.
          </p>
        </Modal>
      )}
    </>
  );
}
