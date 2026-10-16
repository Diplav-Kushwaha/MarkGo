import { useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Eye,
  Package,
  PauseCircle,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  createItem,
  deleteItem,
  getItemStats,
  getItems,
  updateItem,
  updateItemStatus,
} from "../../api/itemAdminApi";
import { formatCurrency } from "../../lib/format";
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
  SkeletonStatCards,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import useDirectoryList from "../../components/admin/useDirectoryList";
import DirectoryToolbar from "../../components/admin/DirectoryToolbar";
import ItemFormModal from "../../components/admin/ItemFormModal";
import ItemDetailsDrawer from "../../components/admin/ItemDetailsDrawer";

async function fetchPage(params) {
  const res = await getItems(params);
  if (!res.success || !res.data) return null;
  return { rows: res.data.items || [], ...(res.data.pagination || {}) };
}

/**
 * Per-type copy and behaviour for the catalogue pages. `itemType` fixes the
 * `type` query param sent to the existing items API, so the list, stats, form
 * and labels all stay scoped to a single type.
 */
const ITEM_TYPES = {
  product: {
    apiType: "PRODUCT",
    title: "Products",
    subtitle: "Manage billable goods, inventory levels and GST tax codes.",
    addLabel: "Add Product",
    emptyTitle: "Your catalogue is empty",
    emptyDescription: "Add your first product to start invoicing.",
    noMatchTitle: "No products match these filters",
    showStockFilter: true,
  },
  service: {
    apiType: "SERVICE",
    title: "Services",
    subtitle: "Manage billable services, units and GST tax codes.",
    addLabel: "Add Service",
    emptyTitle: "Your catalogue is empty",
    emptyDescription: "Add your first service to start invoicing.",
    noMatchTitle: "No services match these filters",
    showStockFilter: false,
  },
};

export default function ItemDirectoryPage({ itemType = "product" }) {
  const config = ITEM_TYPES[itemType] || ITEM_TYPES.product;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const initialQuery = {
    search: "",
    type: config.apiType,
    status: "",
    stockLevel: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    page: 1,
    pageSize: 10,
  };

  const { query, rows, pagination, stats, loading, statsLoading, error, setFilter, setPage, setPageSize, resetFilters, reload } =
    useDirectoryList({ fetchPage, fetchStats: getItemStats, initialQuery });

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setFormError("");
    setFormOpen(true);
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await updateItem(editing.id, payload);
        setFormOpen(false);
        reload();
      } else {
        await createItem(payload);
        setFormOpen(false);
        reload();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save this item.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteItem(pendingDelete.id);
      setPendingDelete(null);
      setFormOpen(false);
      setViewing(null);
      setNotice(`${pendingDelete.name} was removed from the catalogue.`);
      reload();
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to delete item.");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateItemStatus(item.id, nextStatus);
      setNotice(`${item.name} is now ${nextStatus.toLowerCase()}.`);
      reload();
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to update item status.");
    }
  };

  const statCards = [
    {
      label: "Products",
      value: stats?.totalProducts ?? 0,
      hint: "Physical goods in the catalogue",
      icon: Package,
      tone: "primary",
    },
    {
      label: "Services",
      value: stats?.totalServices ?? 0,
      hint: "Billable hours and units",
      icon: Wrench,
      tone: "info",
    },
    {
      label: "Low stock",
      value: stats?.lowStockCount ?? 0,
      hint: "At or below the reorder level",
      icon: AlertTriangle,
      tone: "warning",
    },
    {
      label: "Inactive",
      value: stats?.inactiveItems ?? 0,
      hint: "Hidden from invoicing",
      icon: PauseCircle,
      tone: "muted",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Item",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.name}</div>
          <div className="text-xs text-muted">
            {row.sku ? `SKU: ${row.sku}` : "No SKU"}
            {row.brand ? ` · ${row.brand}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => (
        <StatusBadge
          status={row.type === "SERVICE" ? "OPEN" : "PRODUCT"}
          label={row.type === "SERVICE" ? "Service" : "Product"}
        />
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => (
        <div>
          <div className="text-body">{row.category || "General"}</div>
          {row.subCategory && <div className="text-xs text-muted">{row.subCategory}</div>}
        </div>
      ),
    },
    {
      key: "salesPrice",
      header: "Selling price",
      align: "right",
      render: (row) => (
        <span className="font-medium text-ink">
          {formatCurrency(row.salesPrice)}
          <span className="ml-1 text-xs font-normal text-muted">/{row.unit}</span>
        </span>
      ),
    },
    {
      key: "taxRate",
      header: "GST",
      align: "right",
      render: (row) => (
        <div>
          <div className="text-body">{Number(row.taxRate) || 0}%</div>
          <div className="text-xs text-muted">
            {row.type === "SERVICE" ? `SAC ${row.sacCode || "—"}` : `HSN ${row.hsnCode || "—"}`}
          </div>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      render: (row) => {
        if (row.type === "SERVICE") return <span className="text-muted">—</span>;
        if (!row.trackInventory) return <span className="text-muted">Not tracked</span>;
        return (
          <span className={row.isLowStock ? "font-medium text-warning" : "text-body"}>
            {Number(row.stockQuantity) || 0} {row.unit}
            {row.isLowStock && " · Low"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} dot />,
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
              label: row.status === "ACTIVE" ? "Deactivate" : "Activate",
              icon: PauseCircle,
              onSelect: () => handleToggleStatus(row),
            },
            { label: "Delete", icon: Trash2, tone: "danger", onSelect: () => setPendingDelete(row) },
          ]}
        />
      ),
    },
  ];

  const filters = [
    {
      key: "status",
      value: query.status,
      onChange: (value) => setFilter("status", value),
      placeholder: "All statuses",
      options: [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
      ],
    },
    // Services have no stock, so the stock filter is products-only.
    ...(config.showStockFilter
      ? [
          {
            key: "stockLevel",
            value: query.stockLevel,
            onChange: (value) => setFilter("stockLevel", value),
            placeholder: "All stock levels",
            options: [{ value: "OUT_OF_STOCK", label: "Out of stock" }],
          },
        ]
      : []),
    {
      key: "sortBy",
      value: `${query.sortBy}:${query.sortOrder}`,
      onChange: (value) => {
        const [sortBy, sortOrder] = value.split(":");
        setFilter("sortBy", sortBy);
        setFilter("sortOrder", sortOrder);
      },
      options: [
        { value: "createdAt:desc", label: "Newest first" },
        { value: "createdAt:asc", label: "Oldest first" },
        { value: "name:asc", label: "Name (A-Z)" },
        { value: "name:desc", label: "Name (Z-A)" },
        { value: "salesPrice:desc", label: "Price: high to low" },
        { value: "salesPrice:asc", label: "Price: low to high" },
      ],
    },
  ];

  // The type filter is fixed per page, so it never counts as an applied filter.
  const hasFilters = Boolean(query.search || query.status || query.stockLevel);

  return (
    <>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {config.addLabel}
          </Button>
        }
      />

      {(error || notice) && (
        <Alert
          className="mb-4"
          tone={error ? "error" : "success"}
          title={error ? "Could not load the catalogue" : undefined}
        >
          {error || notice}
        </Alert>
      )}

      <div className="space-y-4">
        {statsLoading ? (
          <SkeletonStatCards count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
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

        <DirectoryToolbar
          searchValue={query.search}
          searchPlaceholder="Search by name, SKU, category, brand or HSN/SAC…"
          onSearchSubmit={(value) => setFilter("search", value.trim())}
          filters={filters}
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
                icon={hasFilters ? Boxes : Plus}
                title={hasFilters ? config.noMatchTitle : config.emptyTitle}
                description={
                  hasFilters
                    ? "Try a different search term or clear the filters."
                    : config.emptyDescription
                }
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {config.addLabel}
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
        <ItemFormModal
          key={editing?.id || "new"}
          isOpen
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          item={editing}
          saving={saving}
          serverError={formError}
          fixedType={config.apiType}
        />
      )}

      {viewing && (
        <ItemDetailsDrawer
          item={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            const target = viewing;
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
          title="Delete catalogue item"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Delete item
              </Button>
            </>
          }
        >
          <p className="text-sm text-body">
            Remove <span className="font-medium text-ink">{pendingDelete.name}</span> from the catalogue?
            Past invoices keep their reference to this item, but it will no longer be selectable on new
            invoices.
          </p>
        </Modal>
      )}
    </>
  );
}
