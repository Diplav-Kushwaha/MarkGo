/**
 * Opens a self-contained print document in a new tab and triggers the browser
 * print dialog, where "Save as PDF" produces the PDF. No PDF dependency is
 * needed on either side — the browser renders the HTML.
 *
 * Returns false when the popup was blocked, so callers can show a message.
 */
export function openPrintWindow(html) {
  const win = window.open("", "_blank");
  if (!win) return false;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();

  // Give the new document a tick to lay out before the dialog opens.
  win.setTimeout(() => {
    try {
      win.print();
    } catch {
      // Some browsers refuse a scripted print; the document is still open and
      // the user can print manually with Ctrl/Cmd + P.
    }
  }, 100);

  return true;
}

/** Escapes text interpolated into the generated document. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Styles shared by the generated print documents, so an invoice and a report
 * look like the same family of paperwork.
 */
export const PRINT_STYLES = `
  @page { margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #111827; margin: 0; padding: 24px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: 1px; }
  h2 { font-size: 13px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .muted { color: #555; }
  .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 12px; }
  .meta { display: flex; gap: 24px; margin: 16px 0; flex-wrap: wrap; }
  .meta div { min-width: 140px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #bbb; padding: 5px 7px; text-align: left; }
  th { background: #f1f1f1; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  td.num, th.num { text-align: right; }
  td.empty { text-align: center; color: #666; }
  .section { margin-top: 22px; }
  .totals { margin-top: 10px; margin-left: auto; width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
  .totals .grand { border-top: 2px solid #000; margin-top: 4px; padding-top: 6px; font-weight: bold; font-size: 14px; }
  .stat-row { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
  .stat { border: 1px solid #bbb; padding: 8px 12px; min-width: 120px; }
  .stat .value { font-size: 15px; font-weight: bold; }
  .footer { margin-top: 28px; font-size: 10px; text-align: center; color: #555; }
`;
