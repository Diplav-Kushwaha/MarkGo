import { Button, Modal } from "../ui";

const VARIANTS = {
  emerald: "primary",
  red: "danger",
  blue: "primary",
  primary: "primary",
  default: "secondary",
};

export default function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmVariant = "emerald",
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={VARIANTS[confirmVariant] || "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText || "Confirm"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-body">{message}</p>
    </Modal>
  );
}
