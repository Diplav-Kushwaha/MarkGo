import { useNavigate, useParams } from "react-router-dom";
import CompanyAdminBillList from "./CompanyAdminBillList";
import CompanyAdminBillForm from "./CompanyAdminBillForm";
import CompanyAdminBillDetail from "./CompanyAdminBillDetail";

/**
 * Bridges the URL to the bill pages' callback props. The page components own
 * the API calls; these wrappers only translate navigation.
 */

export function BillListRoute() {
  const navigate = useNavigate();

  return (
    <CompanyAdminBillList
      onCreateNew={() => navigate("/admin/bills/new")}
      onViewDetail={(id) => navigate(`/admin/bills/${id}`)}
      onEdit={(id) => navigate(`/admin/bills/${id}/edit`)}
    />
  );
}

export function BillNewRoute() {
  const navigate = useNavigate();

  return (
    <CompanyAdminBillForm
      onBack={() => navigate("/admin/bills")}
      onSuccess={(id) => navigate(`/admin/bills/${id}`)}
    />
  );
}

export function BillEditRoute() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <CompanyAdminBillForm
      billId={id}
      onBack={() => navigate("/admin/bills")}
      onSuccess={(billId) => navigate(`/admin/bills/${billId}`)}
    />
  );
}

export function BillDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <CompanyAdminBillDetail
      billId={id}
      onBack={() => navigate("/admin/bills")}
      onEdit={(billId) => navigate(`/admin/bills/${billId}/edit`)}
    />
  );
}
