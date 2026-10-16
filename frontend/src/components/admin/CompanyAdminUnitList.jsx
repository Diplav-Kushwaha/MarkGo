import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Edit, Layers, Package, Pencil, Plus, Shield, Trash2 } from "lucide-react";
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
import UnitFormModal from "../../components/admin/UnitFormModal";
import { createUnit, deleteUnit, getUnitOptions, getUnits, updateUnit } from "../../api/unitAdminApi";

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
  { value: "SIMPLE", label: "Simple" },
  { value: "PACKAGE", label: "Package" },
];

/** Adapts the units list response to the shape useDirectoryList expects. */
async function fetchPage(params) {
  const res = await getUnits(params);
  if (!res.success || !res.data) return null;
  return { rows: res.data.units || [], ...(res.data.pagination || {}) };
}

/** Stat cards: derived from one unfiltered options read. */
async function fetchUnitStats() {
  const res = await getUnitOptions();
  if (!res.success || !res.data) return null;
  const all = res.data || [];
  return {
    totalUnits: all.length,
    builtInUnits: all.filter((u) => u.isBuiltIn).length,
    customUnits: all.filter((u) => !u.isBuiltIn).length,
    packageUnits: all.filter((u) => u.isPackage).length,
  };
}

/** Unit list content for the "Unit" tab of Unit & Category. */
const CompanyAdminUnitList = forwardRef(function CompanyAdminUnitList({ onStatsChange }, ref) {
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formFieldErrors, setFormFieldErrors] = useState({});
  const [existingItem, setExistingItem] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const { query, rows, pagination, stats, loading, statsLoading, error, setFilter, setPage, setPageSize, resetFilters, reload } =
    useDirectoryList({
      fetchPage,
      fetchStats: fetchUnitStats,
      initialQuery: INITIAL_QUERY,
      onStatsChange,
    });

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormError("");
    setFormFieldErrors({});
    setExistingItem(null);
    setFormOpen(true);
  }, []);

  const openEdit = (unit) => {
    setEditing(unit);
    setFormError("");
    setFormFieldErrors({});
    setFormOpen(true);
  };

  // The parent ("Unit & Category") owns the primary action button, so the create
  // action is exposed through the ref — same pattern as the Team page.
  useImperativeHandle(ref, () => ({ openCreate }), [openCreate]);

  const handleSubmit = async (payload) => {
    setSaving(true);
    setFormError("");
    setFormFieldErrors({});
    try {
      const res = editing ? await updateUnit(editing.id, payload) : await createUnit(payload);
      if (res.success) {
        setFormOpen(false);
        setNotice(editing ? "Unit updated." : "Unit created.");
        reload();
      }
    } catch (err) {
      // Field-level validation errors (zod) go under the right
      // form fields; anything else is a generic message. Same
      // pattern as CompanyRegister.
      if (err.response?.status === 409 && err.response?.data?.existing) {
        setExistingItem(err.response.data.existing);
        setFormError(err.response.data.message || "This unit already exists in the shared list.");
        return;
      }
      const fieldErrors = err.response?.data?.errors;
      if (Array.isArray(fieldErrors) && fieldErrors.length) {
        const mapped = {};
        fieldErrors.forEach((item) => {
          mapped[item.field] = item.message;
        });
        setFormFieldErrors(mapped);
        setFormError("Please correct the errors highlighted below.");
      } else {
        setFormError(err.response?.data?.message || "Failed to save unit.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await deleteUnit(pendingDelete.id);
      if (res.success) {
        setPendingDelete(null);
        setFormOpen(false);
        setNotice("Unit deleted.");
        reload();
      }
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to delete unit.");
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
    { label: "Total units", value: stats?.totalUnits ?? 0, icon: Layers, tone: "primary" },
    { label: "Built-in", value: stats?.builtInUnits ?? 0, icon: Shield, tone: "info" },
    { label: "Custom", value: stats?.customUnits ?? 0, icon: Edit, tone: "success" },
    { label: "Package", value: stats?.packageUnits ?? 0, icon: Package, tone: "warning" },
  ];

  const columns = [
    {
      key: "name",
      header: "Unit",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">{row.fullName}</span>
          <span className="text-xs text-muted">/{row.shortName}</span>
          {row.isBuiltIn ? <StatusBadge status="BUILT_IN" tone="muted" label="Default" dot /> : <StatusBadge status={row.isOwn ? "OWN" : "SHARED"} tone={row.isOwn ? "success" : "info"} label={row.isOwn ? "Yours" : "Shared"} />}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) =>
        row.isPackage ? (
          <span className="text-sm text-body">
            1 {row.fullName} = {Number(row.quantity)} {row.baseUnit?.shortName || "—"}
          </span>
        ) : (
          <StatusBadge status="SIMPLE" tone="muted" label="Simple" />
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
          label={`Actions for ${row.fullName}`}
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
        <Alert className="mb-4" tone={error ? "error" : "success"} title={error ? "Could not load units" : undefined}>
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
          searchPlaceholder="Search by full name or short name…"
          onSearchSubmit={(value) => setFilter("search", value.trim())}
          filters={[
            {
              key: "source",
              value: query.source,
              onChange: (value) => setFilter("source", value),
              placeholder: "All sources",
              options: SOURCE_OPTIONS,
            },
            {
              key: "type",
              value: query.type,
              onChange: (value) => setFilter("type", value),
              placeholder: "All types",
              options: TYPE_OPTIONS,
            },
          ]}
          onReset={resetFilters}
          right={<Layers className="h-4 w-4 text-muted" aria-hidden="true" />}
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
                title={hasFilters ? "No units match these filters" : "No units yet"}
                description={
                  hasFilters
                    ? "Try a different search term or clear the filters."
                    : "Add your first unit to use it on products and services."
                }
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add unit
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
        <UnitFormModal
          key={editing?.id || "new"}
          isOpen
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          onDelete={editing?.isOwn ? () => setPendingDelete(editing) : undefined}
          unit={editing}
          saving={saving}
          serverError={formError}
          serverFieldErrors={formFieldErrors}
          existingItem={existingItem}
          onUseExisting={() => { setFormOpen(false); setExistingItem(null); setFilter("search", existingItem?.fullName || ""); }}
        />
      )}

      {pendingDelete && (
        <Modal
          isOpen
          onClose={() => setPendingDelete(null)}
          size="sm"
          title="Delete unit"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Delete unit
              </Button>
            </>
          }
        >
          <p className="text-sm text-body">
            Permanently delete <span className="font-medium text-ink">{pendingDelete.fullName}</span> (/{pendingDelete.shortName})? This
            cannot be undone.
          </p>
        </Modal>
      )}
    </>
  );
});

export default CompanyAdminUnitList;
