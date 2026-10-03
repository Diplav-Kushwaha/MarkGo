import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { SAButton } from "./SuperAdminUi";
import { Modal } from "../../components/ui";

/**
 * Confirm switching a company between Active and Inactive.
 * Only ACTIVE and SUSPENDED companies can reach this.
 */
export function CompanyStatusModal({ open, company, onClose, onConfirm, saving = false, error = "" }) {
  if (!company) return null;

  const deactivating = company.status === "ACTIVE";

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="sm"
      title={deactivating ? "Deactivate company" : "Activate company"}
      footer={
        <>
          <SAButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </SAButton>
          <SAButton
            variant={deactivating ? "danger" : "primary"}
            onClick={onConfirm}
            loading={saving}
          >
            {deactivating ? "Deactivate" : "Activate"}
          </SAButton>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{company.name}</span>
      </p>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      <p className="mt-3 text-sm text-slate-600">
        {deactivating
          ? "Users of this company will not be able to log in while it is inactive. Their data is kept."
          : "Users of this company will be able to log in again."}
      </p>
    </Modal>
  );
}

/**
 * Confirm deleting an abandoned pending registration. The company, its
 * subscriptions, payments and admin account are all removed together.
 */
export function DeletePendingModal({ open, company, onClose, onConfirm, saving = false, error = "" }) {
  if (!company) return null;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="sm"
      title="Delete pending company"
      footer={
        <>
          <SAButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </SAButton>
          <SAButton variant="danger" onClick={onConfirm} loading={saving}>
            Delete company
          </SAButton>
        </>
      }
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
        <p className="text-sm text-slate-600">
          This removes <span className="font-semibold text-slate-900">{company.name}</span> and its
          administrator account. This cannot be undone.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {error}
        </div>
      )}
    </Modal>
  );
}

/** Confirmation for removing a pending company that blocks a new registration. */
export function InlineDeleteConfirm({ open, onClose, onConfirm, saving = false, error = "" }) {
  const [ack, setAck] = useState(false);
  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="sm"
      title="Delete the pending company?"
      footer={
        <>
          <SAButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </SAButton>
          <SAButton
            variant="danger"
            onClick={() => {
              setAck(false);
              onConfirm();
            }}
            loading={saving}
            disabled={!ack}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete pending company
          </SAButton>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        This removes the pending company and its administrator account. This cannot be undone.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-2 focus:ring-blue-200"
        />
        I understand this cannot be undone.
      </label>
    </Modal>
  );
}
