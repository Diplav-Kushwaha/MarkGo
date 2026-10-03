import { useCallback, useEffect, useRef, useState } from "react";

let toastSequence = 0;

/**
 * Small toast queue for the Vendor page. The rest of the app still uses
 * window.confirm/alert, but a page this dense benefits from non-blocking
 * feedback, and toasts let a bulk import report per-row failures without
 * stacking up modal alerts.
 */
export default function useToasts({ duration = 4500 } = {}) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (tone, message, options = {}) => {
      toastSequence += 1;
      const id = toastSequence;
      setToasts((previous) => [
        ...previous,
        { id, tone, message, title: options.title ?? "" },
      ]);

      const timeout = options.duration ?? duration;
      if (timeout > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismissToast(id), timeout)
        );
      }
      return id;
    },
    [duration, dismissToast]
  );

  // Clear any pending timers on unmount so a dismissed toast can't call
  // setState on an unmounted tree.
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    []
  );

  const notifySuccess = useCallback(
    (message, options) => pushToast("success", message, options),
    [pushToast]
  );
  const notifyError = useCallback(
    (message, options) => pushToast("error", message, options),
    [pushToast]
  );
  const notifyInfo = useCallback(
    (message, options) => pushToast("info", message, options),
    [pushToast]
  );

  return { toasts, dismissToast, notifySuccess, notifyError, notifyInfo };
}
