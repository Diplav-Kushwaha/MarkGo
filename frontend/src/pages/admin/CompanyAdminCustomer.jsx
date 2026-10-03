import { useCallback, useEffect, useState } from "react";
import {
  Mail,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import {
  createCustomer,
  createCustomerInvite,
  deleteCustomer,
  getCustomerStats,
  getCustomers,
  updateCustomer,
  updateCustomerStatus,
} from "../../api/customerAdminApi";
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
  hasBalance: "",
  page: 1,
  pageSize: 10,
};

/** Adapts the customer list response to the shape useDirectoryList expects. */
async function fetchPage(params) {
  const res = await getCustomers(params);
  if (!res.success || !res.data) return null;
  return { rows: res.data.customers || [], ...(res.data.pagination || {}) };
}

export default function CompanyAdminCustomer() {
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [invite, setInvite] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const { query, rows, pagination, stats, loading, statsLoading, error, setFilter, setPage, setPageSize, resetFilters, reload } =
    useDirectoryList({ fetchPage, fetchStats: getCustomerStats, initialQuery: INITIAL_QUERY });

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setFormError("");
    setFormOpen(true);
  };

  const generateInvite = useCallback(async (customerId, partyName) => {
    try {
      const res = await createCustomerInvite(customerId);
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
        const res = await updateCustomer(editing.id, payload);
        if (res.success) {
          setFormOpen(false);
          reload();
        }
      } else {
        const res = await createCustomer(payload);
        if (res.success) {
          setFormOpen(false);
          reload();
          // The previous flow also nudged the new customer to be invited.
          if (res.data?.id) generateInvite(res.data.id, res.data.name);
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (customer) => {
    const nextStatus = customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await updateCustomerStatus(customer.id, nextStatus);
      if (res.success) {
        setNotice(`${customer.name} is now ${nextStatus.toLowerCase()}.`);
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
      const res = await deleteCustomer(pendingDelete.id);
      if (res.success) {
        setPendingDelete(null);
        setFormOpen(false);
        setNotice(`${pendingDelete.name} was deleted.`);
        reload();
      }
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to delete customer.");
    } finally {
      setDeleting(false);
    }
  };

  // Transient confirmations clear themselves so a stale success message can't
  // sit on screen after the user has moved on.
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const statCards = [
    {
      label: "Total customers",
      value: stats?.totalCustomers ?? 0,
      hint: `${stats?.activeCustomers ?? 0} active`,
      icon: Users,
      tone: "primary",
    },
    {
      label: "Active",
      value: stats?.activeCustomers ?? 0,
      hint: `${stats?.inactiveCustomers ?? 0} inactive`,
      icon: UserCheck,
      tone: "success",
    },
    {
      label: "Total invoiced",
      value: formatCurrency(stats?.totalInvoiced),
      hint: "Lifetime across all customers",
      icon: Mail,
      tone: "info",
    },
    {
      label: "Outstanding",
      value: formatCurrency(stats?.totalOutstanding),
      hint: `${formatCurrency(stats?.totalPaid)} collected`,
      icon: Wallet,
      tone: "warning",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Customer",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.name}</div>
          <div className="text-xs text-muted">{row.email}</div>
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
      key: "creditLimit",
      header: "Credit limit",
      align: "right",
      render: (row) =>
        row.creditLimit ? formatCurrency(row.creditLimit) : <span className="text-muted">—</span>,
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
              icon: UserCheck,
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
        title="Customers"
        subtitle="Register buyer profiles, send access invites, and monitor account status."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add customer
          </Button>
        }
      />

      {(error || notice) && (
        <Alert
          className="mb-4"
          tone={error ? "error" : "success"}
          title={error ? "Could not load customers" : undefined}
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
              key: "hasBalance",
              value: query.hasBalance,
              onChange: (value) => setFilter("hasBalance", value),
              placeholder: "Any balance",
              options: [{ value: "true", label: "With outstanding balance" }],
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
                icon={query.search || query.status || query.hasBalance ? Users : UserPlus}
                title={
                  query.search || query.status || query.hasBalance
                    ? "No customers match these filters"
                    : "No customers yet"
                }
                description={
                  query.search || query.status || query.hasBalance
                    ? "Try a different search term or clear the filters."
                    : "Add your first customer to start creating invoices."
                }
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add customer
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
          partyLabel="Customer"
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
          title="Delete customer"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Delete customer
              </Button>
            </>
          }
        >
          <p className="text-sm text-body">
            Permanently delete{" "}
            <span className="font-medium text-ink">{pendingDelete.name}</span>? Their invoices and
            payment history stay in your books, but this customer record cannot be recovered.
          </p>
        </Modal>
      )}

      {invite && <InviteLinkModal invite={invite} partyLabel="customer" onClose={() => setInvite(null)} />}
    </>
  );
}
