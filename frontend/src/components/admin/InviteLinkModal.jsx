import { useState } from "react";
import { Link2 } from "lucide-react";
import { Button, Modal } from "../ui";

export default function InviteLinkModal({ invite, partyLabel = "customer", onClose }) {
  const [copied, setCopied] = useState(false);
  if (!invite) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(invite)}
      onClose={onClose}
      size="md"
      title={`Invite link for ${invite.partyName}`}
      description={`Share this link with the ${partyLabel}. They will use it to set their password and sign in.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
          <Button onClick={handleCopy}>{copied ? "Copied" : "Copy link"}</Button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-lg border border-line bg-slate-50 p-4">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <p className="break-all font-mono text-xs text-body select-all">{invite.link}</p>
      </div>
    </Modal>
  );
}
