import { useEffect, useState } from "react";
import {
  Boxes,
  Eye,
  PauseCircle,
  Pencil,
  Plus,
  Power,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  createService,
  deleteService,
  getServiceSummary,
  getServices,
  updateService,
  updateServiceStatus,
} from "../../api/serviceAdminApi";
import { getCategoryOptions } from "../../api/categoryAdminApi";
import { getUnitOptions } from "../../api/unitAdminApi";
import { formatCurrency } from "../../lib/format";
import { SERVICE_STATUS_LABELS, TAX_MODE_LABELS } from "../../lib/serviceConstants";
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
import ServiceFilterBar from "../../components/admin/ServiceFilterBar";
import ServiceFormModal from "../../components/admin/ServiceFormModal";
import ServiceDetailsDrawer from "../../components/admin/ServiceDetailsDrawer";

/**
 * Services page for the new Services logic.
 *
 * Services used to share `ItemDirectoryPage` with Products through an `itemType`
 * prop. The service behaviour diverged enough (its own summary endpoint, the new
 * service fields, unit/category relations and the Available/Not available
 * wording) that it now lives here, exactly as Products does. The shared
 * `ItemDirectoryPage` is left untouched for anything else that renders it.
 *
 * Every request declares `type: "SERVICE"` through `serviceAdminApi`, so the
 * page can only ever read and write service rows.
 */

const INITIAL_QUERY = {
  search: "",
  status: "",
  sort: "newest",
  page: 1,
  pageSize: 10,
};

/** Adapts the service list response to the shape useDirectoryList expects. */
async function fetchPage(params) {
  const res = await getServices(params);
  if (!res.success || !res.data) return null;
  return { rows: res.data.items || [], ...(res.data.pagination || {}) };
}

/** Company-wide service totals, unaffected by the list filters. */
async function fetchStats() {
  const res = await getServiceSummary();
  if (!res.success || !res.data) return null;
  return res.data;
}

/** Loading placeholder that matches the three-card grid exactly. */
function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-card border border-primary-100/70 bg-white/95 p-5 shadow-card">
          <div className="flex items-start justify-between">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-10 rounded-tile" />
          </div>
          <Skeleton className="mt-4 h-7 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export default function ServiceDirectoryPage() {
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
  // the modal is opened. Both come from the Unit & Category page's endpoints.
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

  const openEdit = (service) => {
    setEditing(service);
    setFormError("");
    setFormOpen(true);
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    setFormError("");
    setActionError("");
    try {
      if (editing) {
        await updateService(editing.id, payload);
        setNotice(`${payload.name} was updated.`);
      } else {
        await createService(payload);
        setNotice(`${payload.name} was added to your catalogue.`);
      }
      setFormOpen(false);
      // Reloads the list and the summary cards together.
      reload();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save this service.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (service) => {
    const nextStatus = service.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setActionError("");
    setNotice("");
    try {
      await updateServiceStatus(service.id, nextStatus);
      setNotice(`${service.name} is now ${SERVICE_STATUS_LABELS[nextStatus]}.`);
      reload();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to update this service's status.");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setActionError("");
    setNotice("");
    try {
      await deleteService(pendingDelete.id);
      setNotice(`${pendingDelete.name} was removed from the catalogue.`);
      setPendingDelete(null);
      setFormOpen(false);
      setViewing(null);
      reload();
    } catch (err) {
      setActionError(err.response?.data?.message || "Failed to delete this service.");
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const summaryCards = [
    {
      label: "Total Services",
      value: stats?.totalServices ?? 0,
      hint: "Services in your catalogue",
      icon: Wrench,
      tone: "primary",
    },
    {
      label: "Available Services",
      value: stats?.availableServices ?? 0,
      hint: "Currently offered on invoices",
      icon: Power,
      tone: "success",
    },
    {
      label: "Unavailable Services",
      value: stats?.unavailableServices ?? 0,
      hint: "Hidden from invoicing",
      icon: PauseCircle,
      tone: "muted",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Service",
      render: (row) => <div className="min-w-0 font-medium text-ink">{row.name}</div>,
    },
    {
      key: "serviceCode",
      header: "Code",
      render: (row) =>
        row.serviceCode ? <span className="text-body">{row.serviceCode}</span> : <span className="text-muted">—</span>,
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
      key: "status",
      header: "Status",
      render: (row) => (
        <StatusBadge status={row.status} label={SERVICE_STATUS_LABELS[row.status] || row.status} dot />
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
              label: row.status === "ACTIVE" ? "Mark Not available" : "Mark Available",
              icon: Power,
              onSelect: () => handleToggleStatus(row),
            },
            { label: "Delete", icon: Trash2, tone: "danger", onSelect: () => setPendingDelete(row) },
          ]}
        />
      ),
    },
  ];

  const hasFilters = Boolean(query.search || query.status || query.sort !== INITIAL_QUERY.sort);

  return (
    <>
      <PageHeader
        title="Services"
        subtitle="Manage billable services, units and GST tax codes."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Service
          </Button>
        }
      />

      <div className="space-y-4">
        {(error || notice || actionError) && (
          <Alert
            className="mb-4"
            tone={error || actionError ? "error" : "success"}
            title={error ? "Could not load the services" : actionError ? "Action failed" : undefined}
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

        <ServiceFilterBar
          searchValue={query.search}
          onSearchChange={(value) => setFilter("search", value.trim())}
          statusValue={query.status}
          onStatusChange={(value) => setFilter("status", value)}
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
                icon={hasFilters ? Boxes : Plus}
                title={hasFilters ? "No services match these filters" : "Your catalogue is empty"}
                description={
                  hasFilters
                    ? "Try a different search term or clear the filters."
                    : "Add your first service to start invoicing."
                }
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Service
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
        <ServiceFormModal
          key={editing?.id || "new"}
          isOpen
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          service={editing}
          units={units}
          categories={categories}
          saving={saving}
          serverError={formError}
        />
      )}

      {viewing && (
        <ServiceDetailsDrawer
          service={viewing}
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
          title="Delete service"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Delete service
              </Button>
            </>
          }
        >
          <p className="text-sm text-body">
            Remove <span className="font-medium text-ink">{pendingDelete.name}</span> from the catalogue?
            Past invoices keep their reference to this service, but it will no longer be selectable on new
            invoices.
          </p>
        </Modal>
      )}
    </>
  );
}
