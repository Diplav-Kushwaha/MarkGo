import { InvoiceListRoute } from "./InvoiceRoutes";

/**
 * Invoices are now routed by URL (list / new / :id / :id/edit) instead of the
 * old local view state. This file is kept as a thin entry point to the list.
 */
export default function CompanyAdminInvoice() {
  return <InvoiceListRoute />;
}
