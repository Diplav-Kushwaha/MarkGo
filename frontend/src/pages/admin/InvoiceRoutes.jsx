import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CompanyAdminInvoiceList from "./CompanyAdminInvoiceList";
import CompanyAdminInvoiceForm from "./CompanyAdminInvoiceForm";
import CompanyAdminInvoiceDetail from "./CompanyAdminInvoiceDetail";

/**
 * Bridges the URL to the invoice pages' callback props. The page components
 * own the API calls; these wrappers only translate navigation.
 */

export function InvoiceListRoute() {
  const navigate = useNavigate();

  return (
    <CompanyAdminInvoiceList
      onCreateNew={() => navigate("/admin/invoices/new")}
      onViewDetail={(id) => navigate(`/admin/invoices/${id}`)}
      onEdit={(id) => navigate(`/admin/invoices/${id}/edit`)}
    />
  );
}

export function InvoiceNewRoute() {
  const navigate = useNavigate();

  return (
    <CompanyAdminInvoiceForm
      onBack={() => navigate("/admin/invoices")}
      onSuccess={(id) => navigate(`/admin/invoices/${id}`)}
    />
  );
}

export function InvoiceEditRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const back = useCallback(() => navigate("/admin/invoices"), [navigate]);

  return (
    <CompanyAdminInvoiceForm
      invoiceId={id}
      onBack={back}
      onSuccess={(invoiceId) => navigate(`/admin/invoices/${invoiceId}`)}
    />
  );
}

export function InvoiceDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <CompanyAdminInvoiceDetail
      invoiceId={id}
      onBack={() => navigate("/admin/invoices")}
      onEdit={(invoiceId) => navigate(`/admin/invoices/${invoiceId}/edit`)}
    />
  );
}
