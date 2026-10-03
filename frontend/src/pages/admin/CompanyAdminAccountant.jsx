import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  MailCheck,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  createAccountant,
  createAccountantInvite,
  deleteAccountant,
  getAccountants,
  updateAccountant,
  updateAccountantStatus,
} from "../../api/accountantAdminApi";
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
import InviteLinkModal from "../../components/admin/InviteLinkModal";
import AccountantFormModal from "../../components/admin/AccountantFormModal";

const INITIAL_QUERY = {
  search: "",
  status: "",
  page: 1,
  pageSize: 10,
};

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "name:asc", label: "Name (A-Z)" },
  { value: "name:desc", label: "Name (Z-A)" },
];

/** Adapts the accountants list response (flat, no `totalPages`) for useDirectoryList. */
async function fetchPage(params) {
  const res = await getAccountants(params);
  if (!res.success || !res.data) return null;

  const { accountants = [], total = 0, page = 1, pageSize = 10 } = res.data;
  return { rows: accountants, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}

/**
 * There is no accountant stats endpoint, so the summary is derived from one
 * unfiltered read of the roster — the same approach the staff list uses.
 */
async function fetchRosterStats() {
  const res = await getAccountants({ pageSize: 100 });
  if (!res.success || !res.data) return null;

  const roster = res.data.accountants || [];
  return {
    totalAccountants: res.data.total ?? roster.length,
    activeAccountants: roster.filter((member) => member.status === "ACTIVE").length,
    inactiveAccountants: roster.filter((member) => member.status === "INACTIVE").length,
    awaitingInvite: roster.filter((member) => !member.passwordHash).length,
    licensed: roster.filter((member) => member.licenseNumber).length,
  };
}

/**
 * Accountant list content for the Team page. It renders no page header or tabs —
 * TeamPage owns those so the primary action can change with the active tab.
 */
const CompanyAdminAccountant = forwardRef(function CompanyAdminAccountant({ onStatsChange }, ref) {
  const [sort, setSort] = useState("createdAt:desc");
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [invite, setInvite] = useState(null);
  const [invitingId, setInvitingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const { query, rows, pagination, stats, loading, statsLoading, error, setFilter, setPage, setPageSize, resetFilters, reload } =
    useDirectoryList({
      fetchPage,
      fetchStats: fetchRosterStats,
      initialQuery: INITIAL_QUERY,
      onStatsChange,
    });

  // The endpoint has no server-side sorting, so the current page is ordered here.
  const sortedRows = useMemo(() => {
    const [field, direction] = sort.split(":");
    if (!field) return rows;

    return [...rows].sort((a, b) => {
      const left = String(a[field] ?? "").toLowerCase();
      const right = String(b[field] ?? "").toLowerCase();
      if (left === right) return 0;
      return (left < right ? -1 : 1) * (direction === "asc" ? 1 : -1);
    });
  }, [rows, sort]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }, []);

  const openEdit = (accountant) => {
    setEditing(accountant);
    setFormError("");
    setFormOpen(true);
  };

  // TeamPage owns the primary action button, so the create action is exposed
  // through the ref. Declared after openCreate to avoid a TDZ reference.
  useImperativeHandle(ref, () => ({ openCreate }), [openCreate]);

  const generateInvite = useCallback(async (accountantId, partyName) => {
    try {
      setInvitingId(accountantId);
      const res = await createAccountantInvite(accountantId);
      if (res.success && res.data?.inviteLink) {
        setInvite({ partyName, link: res.data.inviteLink });
      }
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to generate invite link.");
    } finally {
      setInvitingId(null);
    }
  }, []);

  const handleSubmit = async (payload) => {
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        const res = await updateAccountant(editing.id, payload);
        if (res.success) {
          setFormOpen(false);
          reload();
        }
      } else {
        const res = await createAccountant(payload);
        if (res.success) {
          setFormOpen(false);
          reload();
          if (res.data?.id) generateInvite(res.data.id, res.data.name);
        }
      }
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save accountant.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (accountant) => {
    const nextStatus = accountant.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await updateAccountantStatus(accountant.id, nextStatus);
      if (res.success) {
        setNotice(`${accountant.name} is now ${nextStatus.toLowerCase()}.`);
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
      const res = await deleteAccountant(pendingDelete.id);
      if (res.success) {
        setPendingDelete(null);
        setFormOpen(false);
        setNotice(`${pendingDelete.name} was removed.`);
        reload();
      }
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to delete accountant.");
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
      label: "Total accountants",
      value: stats?.totalAccountants ?? 0,
      hint: "Internal bookkeepers and CPAs",
      icon: Users,
      tone: "primary",
    },
    {
      label: "Active",
      value: stats?.activeAccountants ?? 0,
      hint: `${stats?.inactiveAccountants ?? 0} inactive`,
      icon: UserCheck,
      tone: "success",
    },
    {
      label: "Awaiting invite",
      value: stats?.awaitingInvite ?? 0,
      hint: "Have not set a password yet",
      icon: MailCheck,
      tone: "warning",
    },
    {
      label: "Licensed",
      value: stats?.licensed ?? 0,
      hint: "Have a registration number",
      icon: BadgeCheck,
      tone: "info",
    },
  ];

  const columns = [
    {
      key: "name",
      header: "Accountant",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.name}</div>
          <div className="text-xs text-muted">{row.email}</div>
        </div>
      ),
    },
    {
      key: "licenseNumber",
      header: "License / experience",
      render: (row) => (
        <div>
          <div className="text-body">{row.licenseNumber || "CPA / Auditor"}</div>
          <div className="text-xs text-muted">{row.experience || "Active"}</div>
        </div>
      ),
    },
    {
      key: "phoneNumber",
      header: "Phone",
      render: (row) => row.phoneNumber || <span className="text-muted">—</span>,
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
              disabled: invitingId === row.id,
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

  const hasFilters = Boolean(query.search || query.status);

  return (
    <>
      {(error || notice) && (
        <Alert
          className="mb-4"
          tone={error ? "error" : "success"}
          title={error ? "Could not load accountants" : undefined}
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
          searchPlaceholder="Search by name, email, license number or phone…"
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
          ]}
          onReset={resetFilters}
          right={<ShieldCheck className="h-4 w-4 text-muted" aria-hidden="true" />}
        />

        <Card>
          <DataTable
            contained
            columns={columns}
            rows={sortedRows}
            loading={loading}
            onRowClick={openEdit}
            empty={
              <EmptyState
                icon={hasFilters ? ShieldCheck : UserPlus}
                title={hasFilters ? "No accountants match these filters" : "No accountants yet"}
                description={
                  hasFilters
                    ? "Try a different search term or clear the filters."
                    : "Add your first accountant to give them portal access."
                }
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add accountant
                  </Button>
                }
              />
            }
          />
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-body focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {formOpen && (
        <AccountantFormModal
          key={editing?.id || "new"}
          isOpen
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
          onDelete={editing ? () => setPendingDelete(editing) : undefined}
          accountant={editing}
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
          title="Delete accountant"
          footer={
            <>
              <Button variant="secondary" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Delete accountant
              </Button>
            </>
          }
        >
          <p className="text-sm text-body">
            Permanently delete <span className="font-medium text-ink">{pendingDelete.name}</span>? They
            will lose portal access immediately and this cannot be undone.
          </p>
        </Modal>
      )}

      {invite && <InviteLinkModal invite={invite} partyLabel="accountant" onClose={() => setInvite(null)} />}
    </>
  );
});

export default CompanyAdminAccountant;
