import { BillListRoute } from "./BillRoutes";

/**
 * Bills are now routed by URL (list / new / :id / :id/edit) instead of the old
 * local view state. This file is kept as a thin entry point to the list.
 */
export default function CompanyAdminBill() {
  return <BillListRoute />;
}
