/**
 * Seeds the three subscription plans: Free, Monthly and Yearly.
 *
 * Safe to run repeatedly: plans are matched by name, and an existing plan is
 * never re-priced or deactivated.
 *
 * DRY RUN by default — nothing is written without --apply:
 *
 *   node prisma/seedPlans.js            # report only, writes nothing
 *   node prisma/seedPlans.js --apply    # actually write
 */

import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ *
 * PLAN DEFINITIONS — edit these numbers, nothing else.
 *
 * A null limit means unlimited. durationMonths is null for the Free plan,
 * which never expires.
 * ------------------------------------------------------------------ */
const PLANS = [
  {
    name: "Free",
    price: 0,
    billingCycle: "FREE",
    durationMonths: null,
    description: "Get started with the essentials. Never expires.",
    maxUsers: 2,
    maxStaff: 2,
    maxCustomers: 10,
    maxVendors: 10,
    maxInvoices: 20,
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "Monthly",
    price: 999,
    billingCycle: "MONTHLY",
    durationMonths: 1,
    description: "Everything you need, billed every month. No limits.",
    maxUsers: null,
    maxStaff: null,
    maxCustomers: null,
    maxVendors: null,
    maxInvoices: null,
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "Yearly",
    price: 9999,
    billingCycle: "YEARLY",
    durationMonths: 12,
    description: "Everything you need, billed once a year. No limits.",
    maxUsers: null,
    maxStaff: null,
    maxCustomers: null,
    maxVendors: null,
    maxInvoices: null,
    isActive: true,
    sortOrder: 3,
  },
];

/**
 * Fields written when a plan already exists. Deliberately excludes price,
 * isActive, description, sortOrder and the pre-existing limit columns, so
 * re-running can never quietly re-price a plan a Super Admin has edited.
 */
const BACKFILL_FIELDS = ["billingCycle", "durationMonths", "maxVendors", "maxStaff"];
const PRESERVED_FIELDS = [
  "price",
  "isActive",
  "description",
  "sortOrder",
  "maxUsers",
  "maxCustomers",
  "maxInvoices",
];

const APPLY = process.argv.includes("--apply");

const money = (value) => new Decimal(value).toFixed(2);

async function main() {
  console.log("");
  console.log(APPLY ? "=== seedPlans: APPLYING ===" : "=== seedPlans: DRY RUN (nothing will be written) ===");
  console.log("");

  const created = [];
  const updated = [];
  const untouched = [];

  for (const plan of PLANS) {
    const existing = await prisma.plan.findUnique({ where: { name: plan.name } });

    if (!existing) {
      console.log(`[CREATE] ${plan.name}`);
      console.log(
        `         price=${money(plan.price)}  cycle=${plan.billingCycle}  durationMonths=${plan.durationMonths ?? "(none)"}`
      );
      console.log(
        `         limits: users=${plan.maxUsers ?? "∞"} staff=${plan.maxStaff ?? "∞"} customers=${plan.maxCustomers ?? "∞"} vendors=${plan.maxVendors ?? "∞"} invoices=${plan.maxInvoices ?? "∞"}`
      );

      if (APPLY) {
        const row = await prisma.plan.create({
          data: {
            name: plan.name,
            price: new Decimal(plan.price),
            description: plan.description,
            billingCycle: plan.billingCycle,
            durationMonths: plan.durationMonths,
            maxUsers: plan.maxUsers,
            maxStaff: plan.maxStaff,
            maxCustomers: plan.maxCustomers,
            maxVendors: plan.maxVendors,
            maxInvoices: plan.maxInvoices,
            isActive: plan.isActive,
            sortOrder: plan.sortOrder,
          },
        });
        created.push(row.name);
      }
      continue;
    }

    // Existing plan: only fill in the fields this feature introduced.
    const changes = BACKFILL_FIELDS.filter((field) => {
      const wanted = plan[field];
      const current = existing[field];
      if (wanted === null || wanted === undefined) return current !== null && current !== undefined;
      return current !== wanted;
    });

    if (changes.length === 0) {
      console.log(`[OK]    ${plan.name} — already correct, nothing to do`);
      untouched.push(plan.name);
      continue;
    }

    console.log(`[UPDATE] ${plan.name}`);
    for (const field of changes) {
      const value = plan[field] === null || plan[field] === undefined ? "(none)" : plan[field];
      console.log(`         ${field}: ${existing[field] ?? "(none)"}  ->  ${value}`);
    }
    console.log(`         left alone: ${PRESERVED_FIELDS.join(", ")}`);

    if (APPLY) {
      const data = {};
      for (const field of changes) data[field] = plan[field];
      await prisma.plan.update({ where: { id: existing.id }, data });
      updated.push(plan.name);
    }
  }

  console.log("");
  console.log(`Summary -> created: ${created.length ? created.join(", ") : "none"}`);
  console.log(`           updated: ${updated.length ? updated.join(", ") : "none"}`);
  console.log(`          untouched: ${untouched.length ? untouched.join(", ") : "none"}`);

  if (!APPLY) {
    console.log("");
    console.log("Dry run only. Re-run with --apply to write these changes.");
  } else {
    console.log("");
    console.log("Done. Safe to run again — a second run reports everything as OK.");
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("seedPlans failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });