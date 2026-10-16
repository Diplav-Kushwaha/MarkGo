import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Pencil,
  Plus,
  Send,
  ShoppingCart,
  Store,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  createVendor,
  createVendorInvite,
  deleteVendor,
  getVendorStats,
  getVendors,
  updateVendor,
  updateVendorStatus,
} from "../../api/vendorAdminApi";
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
import InviteLinkModal from "../../components/admin/InviteLinkModal";
import PartyFormModal from "../../components/admin/PartyFormModal";

const INITIAL_QUERY = {
  search: "",
  status: "",
  vendorType: "",
  page: 1,
  pageSize: 10,
};

/** Adapts the vendor list response to the shape useDirectoryList expects. */
async function fetchPage(params) {
  const res = await getVendors(params);
  if (!res.success || !res.data) return null;
  return { rows: res.data.vendors || [], ...(res.data.pagination || {}) };
}

export default function CompanyAdminVendor() {
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [invite, setInvite] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const { query, rows, pagination, stats, loading, statsLoading, error, setFilter, setPage, setPageSize, resetFilters, reload } =
    useDirectoryList({ fetchPage, fetchStats: getVendorStats, initialQuery: INITIAL_QUERY });

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (vendor) => {
    setEditing(vendor);
    setFormError("");
    setFormOpen(true);
  };

  const generateInvite = useCallback(async (vendorId, partyName) => {
    try {
      const res = await createVendorInvite(vendorId);
      if (res.success && res.data?.inviteLink) {
        setInvite({ partyName, link: res.data.inviteLink });
      }
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to generate invite link.");
    }
  }, []);

  const handleSubmit = async (payload) => {
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        const res = await updateVendor(editing.id, payload);
        if (res.success) {
          setFormOpen(false);
          reload();
        }
      } else {
        const res = await createVendor(payload);
        if (res.success) {
          setFormOpen(false);
          reload();
          if (res.data?.id) generateInvite(res.data.id, res.data.name);
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save vendor.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (vendor) => {
    const nextStatus = vendor.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await updateVendorStatus(vendor.id, nextStatus);
      if (res.success) {
        setNotice(`${vendor.name} is now ${nextStatus.toLowerCase()}.`);
        reload();
      }
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to update status.");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const res = await deleteVendor(pendingDelete.id);
      if (res.success) {
        setPendingDelete(null);
        setFormOpen(false);
        setNotice(`${pendingDelete.name} was deleted.`);
        reload();
      }
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to delete vendor.");
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
    {
      label: "Total vendors",
      value: stats?.totalVendors ?? 0,
      hint: `${stats?.activeVendors ?? 0} active`,
      icon: Store,
      tone: "primary",
    },
    {
      label: "Active vendors",
      value: stats?.activeVendors ?? 0,
      hint: `${stats?.inactiveVendors ?? 0} inactive`,
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Total purchased",
      value: formatCurrency(stats?.totalPurchased),
      hint: `${formatCurrency(stats?.totalPaid)} paid`,
      icon: ShoppingCart,
      tone: "info",
    },
    {
      label: "Outstanding payable",
      value: formatCurrency(stats?.totalOutstandingPayable),
      hint: "Unpaid bills across vendors",
      icon: Wallet,
      tone: "warning",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Vendor",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.name}</div>
          <div className="text-xs text-muted">{row.phoneNumber || "—"}</div>
        </div>
      ),
    },
    {
      key: "phoneNumber",
      header: "Phone",
      render: (row) => row.phoneNumber || <span className="text-muted">—</span>,
    },
    {
      key: "taxNumber",
      header: "GSTIN",
      render: (row) =>
        row.taxNumber ? (
          <span className="font-mono text-xs text-body">{row.taxNumber}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "outstandingPayable",
      header: "Outstanding",
      align: "right",
      render: (row) => (
        <span className={Number(row.outstandingPayable) > 0 ? "font-medium text-warning" : "text-muted"}>
          {formatCurrency(row.outstandingPayable)}
        </span>
      ),
    },
    {
      key: "login",
      header: "Login",
      render: (row) => (
        <StatusBadge
          status={row.passwordHash ? "ACTIVE" : "PENDING"}
          label={row.passwordHash ? "Password set" : "Invite pending"}
          dot
        />
      ),
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
            {
              label: "Edit details",
              icon: Pencil,
              tone: "primary",
              onSelect: () => openEdit(row),
            },
            {
              label: row.passwordHash ? "Re-send invite" : "Send invite link",
              icon: Send,
              onSelect: () => generateInvite(row.id, row.name),
            },
            {
              label: row.status === "ACTIVE" ? "Deactivate" : "Activate",
              icon: CheckCircle2,
              onSelect: () => handleToggleStatus(row),
            },
            {
              label: "Delete",
              icon: Trash2,
              tone: "danger",
              onSelect: () => setPendingDelete(row),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="Register suppliers, send login invites, and track what you owe them."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add vendor
          </Button>
        }
      />

      {(error || notice) && (
        <Alert className="mb-4" tone={error ? "error" : "success"} title={error ? "Could not load vendors" : undefined}>
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
          searchPlaceholder="Search by name, email, GSTIN or phone…"
          onSearchSubmit={(value) => setFilter("search", value.trim())}
          filters={[
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
            {
              key: "vendorType",
              value: query.vendorType,
              onChange: (value) => setFilter("vendorType", value),
              placeholder: "All types",
              options: [
                { value: "INDIVIDUAL", label: "Individual" },
                { value: "BUSINESS", label: "Business" },
                { value: "SERVICE_PROVIDER", label: "Service provider" },
              ],
            },
          ]}
          onReset={resetFilters}
        />

        <Card>
          <DataTable
            contained
            columns={columns}
            rows={rows}
            loading={loading}
            onRowClick={openEdit}
            empty={
              <EmptyState
                icon={query.search || query.status || query.vendorType ? Building2 : Store}
                title={
                  query.search || query.status || query.vendorType
                    ? "No vendors match these filters"
                    : "No vendors yet"
                }
                description={
                  query.search || query.status || query.vendorType
                    ? "Try a different search term or clear the filters."
                    : "Add your first supplier to start recording bills."
                }
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add vendor
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
        <PartyFormModal
          key={editing?.id || "new"}
          isOpen
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          onDelete={editing ? () => setPendingDelete(editing) : undefined}
          party={editing}
          mode={editing ? "edit" : "add"}
          partyLabel="Vendor"
          nameLabel="Vendor / Company Name"
          addressLabel="Billing / Business Address"
          saving={saving}
          deleting={deleting}
          serverError={formError}
        />
      )}

      {pendingDelete && (
        <Modal
          isOpen
          onClose={() => setPendingDelete(null)}
          size="sm"
          title="Delete vendor"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Delete vendor
              </Button>
            </>
          }
        >
          <p className="text-sm text-body">
            Permanently delete <span className="font-medium text-ink">{pendingDelete.name}</span>? Bills
            and payments recorded against them stay in your books, but this vendor record cannot be
            recovered.
          </p>
        </Modal>
      )}

      {invite && <InviteLinkModal invite={invite} partyLabel="vendor" onClose={() => setInvite(null)} />}
    </>
  );
}
