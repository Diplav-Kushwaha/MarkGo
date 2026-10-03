import prisma from "../prisma.js";

/**
 * How much a company currently uses, measured against plan limits.
 *
 * Counting rules, and why:
 *  - users     every User row on the company. `User` has no isDeleted and no
 *              status column; `isActive` is a login switch, not a delete, so a
 *              deactivated-but-still-present admin still occupies a seat.
 *  - staff     every Staff row. `Staff` has no soft delete either, only a
 *              StaffStatus, so the row count is the honest measure of usage.
 *  - customers soft-deleted rows excluded (isDeleted), matching the existing
 *              convention in itemService.getItemStats.
 *  - vendors   soft-deleted rows excluded, same reason.
 *  - invoices  excluding CANCELLED, the same basis as the revenue report.
 *
 * Always scoped to one company; reused later for plan-limit enforcement.
 */
export async function getUsage(companyId) {
  const [users, staff, customers, vendors, invoices] = await Promise.all([
    prisma.user.count({ where: { companyId } }),
    prisma.staff.count({ where: { companyId } }),
    prisma.customer.count({ where: { companyId, isDeleted: false } }),
    prisma.vendor.count({ where: { companyId, isDeleted: false } }),
    prisma.invoice.count({ where: { companyId, status: { not: "CANCELLED" } } }),
  ]);

  return { users, staff, customers, vendors, invoices };
}