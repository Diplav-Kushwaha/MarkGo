import ProductDirectoryPage from "../../components/admin/ProductDirectoryPage";

/**
 * Products page.
 *
 * Renders the product-specific directory (summary cards, product filters, the
 * new product form fields and Available/Not available labels). Services keep
 * their own page, which still renders `ItemDirectoryPage itemType="service"`
 * through its original code path.
 */
export default function CompanyAdminProduct() {
  return <ProductDirectoryPage />;
}
