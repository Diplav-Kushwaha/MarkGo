import ServiceDirectoryPage from "../../components/admin/ServiceDirectoryPage";

/**
 * Services page.
 *
 * Renders the service-specific directory for the new Services logic (service
 * summary cards, the new filters, serviceCode / unit / category columns and the
 * Available/Not available wording). Products keep their own page, which renders
 * `ProductDirectoryPage` through its own code path.
 */
export default function CompanyAdminService() {
  return <ServiceDirectoryPage />;
}
