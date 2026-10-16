import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Edit, Grid2X2, Layers, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  Modal,
  Pagination,
  RowActions,
  SkeletonStatCards,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import useDirectoryList from "../../components/admin/useDirectoryList";
import DirectoryToolbar from "../../components/admin/DirectoryToolbar";
import CategoryFormModal from "../../components/admin/CategoryFormModal";
import { createCategory, deleteCategory, getCategories, getCategoryOptions, updateCategory } from "../../api/categoryAdminApi";

const INITIAL_QUERY = {
  search: "",
  source: "",
  type: "",
  page: 1,
  pageSize: 10,
};

const SOURCE_OPTIONS = [
  { value: "BUILT_IN", label: "Built-in" },
  { value: "CUSTOM", label: "Custom" },
];

const TYPE_OPTIONS = [
  { value: "PRODUCT", label: "Product" },
  { value: "SERVICE", label: "Service" },
];

/** Adapts the categories list response to the shape useDirectoryList expects. */
async function fetchPage(params) {
  const res = await getCategories(params);
  if (!res.success || !res.data) return null;
  return { rows: res.data.categories || [], ...(res.data.pagination || {}) };
}

/** Stat cards: derived from one unfiltered options read. */
async function fetchCategoryStats() {
  const res = await getCategoryOptions();
  if (!res.success || !res.data) return null;
  const all = res.data || [];
  return {
    totalCategories: all.length,
    productCategories: all.filter((c) => c.type === "PRODUCT").length,
    serviceCategories: all.filter((c) => c.type === "SERVICE").length,
    customCategories: all.filter((c) => !c.isBuiltIn).length,
  };
}

/** Category list content for the "Category" tab of Unit & Category. */
const CompanyAdminCategoryList = forwardRef(function CompanyAdminCategoryList({ onStatsChange }, ref) {
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [existingItem, setExistingItem] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const { query, rows, pagination, stats, loading, statsLoading, error, setFilter, setPage, setPageSize, resetFilters, reload } =
    useDirectoryList({
      fetchPage,
      fetchStats: fetchCategoryStats,
      initialQuery: INITIAL_QUERY,
      onStatsChange,
    });

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormError("");
    setExistingItem(null);
    setFormOpen(true);
  }, []);

  const openEdit = (category) => {
    setEditing(category);
    setFormError("");
    setFormOpen(true);
  };

  // The parent owns the primary "+ Add" button, so create is exposed via the ref.
  useImperativeHandle(ref, () => ({ openCreate }), [openCreate]);

  const handleSubmit = async (payload) => {
    setSaving(true);
    setFormError("");
    try {
      const res = editing ? await updateCategory(editing.id, payload) : await createCategory(payload);
      if (res.success) {
        setFormOpen(false);
        setNotice(editing ? "Category updated." : "Category created.");
        reload();
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.existing) {
        setExistingItem(err.response.data.existing);
        setFormError(err.response.data.message || "This category already exists in the shared list.");
        return;
      }
      setFormError(err.response?.data?.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await deleteCategory(pendingDelete.id);
      if (res.success) {
        setPendingDelete(null);
        setFormOpen(false);
        setNotice("Category deleted.");
        reload();
      }
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to delete category.");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const statCards = [
    { label: "Total categories", value: stats?.totalCategories ?? 0, icon: Grid2X2, tone: "primary" },
    { label: "Product", value: stats?.productCategories ?? 0, icon: Tag, tone: "success" },
    { label: "Service", value: stats?.serviceCategories ?? 0, icon: Layers, tone: "info" },
    { label: "Custom", value: stats?.customCategories ?? 0, icon: Edit, tone: "warning" },
  ];

  const columns = [
    {
      key: "name",
      header: "Category",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{row.name}</span>
          {row.isBuiltIn ? <StatusBadge status="BUILT_IN" tone="muted" label="Default" dot /> : <StatusBadge status={row.isOwn ? "OWN" : "SHARED"} tone={row.isOwn ? "success" : "info"} label={row.isOwn ? "Yours" : "Shared"} />}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => (
        <StatusBadge
          status={row.type}
          label={row.type === "PRODUCT" ? "Product" : "Service"}
          tone={row.type === "PRODUCT" ? "success" : "info"}
          dot
        />
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (row) =>
        row.isBuiltIn ? (
          <StatusBadge status="BUILT_IN" tone="muted" label="Built-in" />
        ) : (
          <StatusBadge status={row.isOwn ? "OWN" : "SHARED"} tone={row.isOwn ? "success" : "info"} label={row.isOwn ? "Yours" : "Shared"} />
        ),
    },
    {
      key: "actions",
      header: "",
      width: "72px",
      align: "right",
      render: (row) => row.isOwn ? (
        <RowActions
          label={`Actions for ${row.name}`}
          actions={
            row.isOwn ? [
                  {
                    label: "Edit",
                    icon: Pencil,
                    tone: "primary",
                    onSelect: () => openEdit(row),
                  },
                  {
                    label: "Delete",
                    icon: Trash2,
                    tone: "danger",
                    onSelect: () => setPendingDelete(row),
                  },
                ] : []
          }
        />
      ) : null,
    },
  ];

  const hasFilters = Boolean(query.search || query.source || query.type);

  return (
    <>
      {(error || notice) && (
        <Alert className="mb-4" tone={error ? "error" : "success"} title={error ? "Could not load categories" : undefined}>
          {error || notice}
        </Alert>
      )}

      <div className="space-y-4">
        {statsLoading ? (
          <SkeletonStatCards count={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} tone={card.tone} />
            ))}
          </div>
        )}

        <DirectoryToolbar
          searchValue={query.search}
          searchPlaceholder="Search by category name…"
          onSearchSubmit={(value) => setFilter("search", value.trim())}
          filters={[
            {
              key: "type",
              value: query.type,
              onChange: (value) => setFilter("type", value),
              placeholder: "All types",
              options: TYPE_OPTIONS,
            },
            {
              key: "source",
              value: query.source,
              onChange: (value) => setFilter("source", value),
              placeholder: "All sources",
              options: SOURCE_OPTIONS,
            },
          ]}
          onReset={resetFilters}
          right={<Tag className="h-4 w-4 text-muted" aria-hidden="true" />}
        />

        <Card>
          <DataTable
            contained
            columns={columns}
            rows={rows}
            loading={loading}
            onRowClick={(row) => row.isOwn && openEdit(row)}
            empty={
              <EmptyState
                icon={hasFilters ? Layers : Plus}
                title={hasFilters ? "No categories match these filters" : "No categories yet"}
                description={
                  hasFilters
                    ? "Try a different search term or clear the filters."
                    : "Add your first category to group products and services."
                }
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add category
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
        <CategoryFormModal
          key={editing?.id || "new"}
          isOpen
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          onDelete={editing?.isOwn ? () => setPendingDelete(editing) : undefined}
          category={editing}
          saving={saving}
          serverError={formError}
          existingItem={existingItem}
          onUseExisting={() => { setFormOpen(false); setExistingItem(null); setFilter("search", existingItem?.name || ""); }}
        />
      )}

      {pendingDelete && (
        <Modal
          isOpen
          onClose={() => setPendingDelete(null)}
          size="sm"
          title="Delete category"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Delete category
              </Button>
            </>
          }
        >
          <p className="text-sm text-body">
            Permanently delete <span className="font-medium text-ink">{pendingDelete.name}</span>? This cannot be undone.
          </p>
        </Modal>
      )}
    </>
  );
});

export default CompanyAdminCategoryList;
