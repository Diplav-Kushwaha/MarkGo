/**
 * Gives every company that has no subscription an ACTIVE one.
 *
 * No Company row is ever modified — not status, not planId, nothing. The
 * subscription table is the only thing written, so an expired or suspended
 * company can never be locked out by this script; deciding what to do about
 * those companies is step 7's job (and the Super Admin console's).
 *
 * DRY RUN by default — nothing is written without --apply AND --yes:
 *
 *   node prisma/backfillSubscriptions.js
 *   node prisma/backfillSubscriptions.js --apply --yes
 *   node prisma/backfillSubscriptions.js --plan=Monthly --apply --yes
 *   node prisma/backfillSubscriptions.js --company=<companyId> --apply --yes
 */

import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

/** Plan used for companies that get no --plan flag. */
const DEFAULT_PLAN_NAME = "Free";

function flagValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const APPLY = process.argv.includes("--apply");
const CONFIRMED = process.argv.includes("--yes");
const PLAN_NAME = flagValue("plan") || DEFAULT_PLAN_NAME;
const ONLY_COMPANY_ID = flagValue("company");

const money = (value) => new Decimal(value).toFixed(2);

async function main() {
  console.log("");
  console.log(
    APPLY
      ? "=== backfillSubscriptions: APPLYING ==="
      : "=== backfillSubscriptions: DRY RUN (nothing will be written) ==="
  );
  console.log(`Plan: ${PLAN_NAME}${ONLY_COMPANY_ID ? ` | company: ${ONLY_COMPANY_ID}` : ""}`);
  console.log("");

  const plan = await prisma.plan.findUnique({ where: { name: PLAN_NAME } });
  if (!plan) {
    console.error(`Plan "${PLAN_NAME}" does not exist.`);
    console.error("Run this first:  node prisma/seedPlans.js --apply");
    console.error(`Available plans: ${(await prisma.plan.findMany({ select: { name: true } })).map((p) => p.name).join(", ") || "none"}`);
    process.exitCode = 1;
    return;
  }

  // Price always comes from the plan row in the database, never from here.
  const priceAtPurchase = new Decimal(plan.price);
  const isFree = plan.billingCycle === "FREE" || plan.durationMonths === null;

  console.log(
    `Plan details -> cycle=${plan.billingCycle} durationMonths=${plan.durationMonths ?? "(none)"} price=${money(priceAtPurchase)}`
  );
  console.log("");

  const companies = await prisma.company.findMany({
    where: ONLY_COMPANY_ID ? { id: ONLY_COMPANY_ID } : undefined,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      planId: true,
      subscriptions: { select: { id: true }, take: 1 },
    },
  });

  if (companies.length === 0) {
    console.log(ONLY_COMPANY_ID
      ? `No company found with id ${ONLY_COMPANY_ID}.`
      : "No companies found.");
    if (!APPLY) console.log("\nNo changes were made.");
    console.log("");
    return;
  }

  const now = new Date();
  const endDate = new Date(now);
  if (!isFree && plan.durationMonths) {
    endDate.setMonth(endDate.getMonth() + plan.durationMonths);
  }

  const toCreate = companies.filter((c) => c.subscriptions.length === 0);
  const skipped = companies.filter((c) => c.subscriptions.length > 0);

  console.log(`Companies found: ${companies.length}`);
  console.log(`Already have a subscription (skipping): ${skipped.length}`);
  for (const company of skipped) {
    console.log(`  [SKIP] ${company.name} — already subscribed`);
  }
  console.log("");

  if (toCreate.length === 0) {
    console.log("Nothing to do — every company already has a subscription.");
    if (!APPLY) console.log("\nNo changes were made.");
    console.log("");
    return;
  }

  console.log(`Would create ${toCreate.length} subscription(s):`);
  for (const company of toCreate) {
    console.log(
      `  [NEW ] ${company.name}  (id=${company.id}, status=${company.status}, planId=${company.planId ?? "null"})`
    );
    console.log(
      `         -> ${PLAN_NAME}  status=ACTIVE  cycle=${plan.billingCycle}  price=${money(priceAtPurchase)}  start=${now.toISOString()}  end=${isFree ? "(never expires)" : endDate.toISOString()}  createdBy=SYSTEM`
    );
  }
  console.log("");

  if (!APPLY) {
    console.log(`Summary -> would create: ${toCreate.length}, skipped: ${skipped.length}`);
    console.log("");
    console.log("Dry run only. No changes were made.");
    console.log("Re-run with --apply --yes to write them.");
    console.log("");
    return;
  }

  if (!CONFIRMED) {
    console.log("Nothing was written: --apply also needs --yes.");
    console.log("Take a database backup first:  npm run db:backup");
    console.log("Then re-run with --apply --yes.");
    console.log("");
    return;
  }

  console.log("APPLYING. Each company is written in its own transaction.");
  console.log("");

  let created = 0;
  const failures = [];

  for (const company of toCreate) {
    try {
      await prisma.$transaction(async (tx) => {
        // Re-check inside the transaction so a subscription created while this
        // script was running is never duplicated.
        const existing = await tx.subscription.findFirst({
          where: { companyId: company.id },
          select: { id: true },
        });
        if (existing) return false;

        await tx.subscription.create({
          data: {
            companyId: company.id,
            planId: plan.id,
            status: "ACTIVE",
            billingCycle: plan.billingCycle,
            priceAtPurchase,
            startDate: now,
            endDate: isFree ? null : endDate,
            createdBy: "SYSTEM",
          },
        });
        return true;
      });
      created += 1;
      console.log(`  [DONE] ${company.name}`);
    } catch (err) {
      failures.push({ company, error: err });
      console.log(`  [FAIL] ${company.name} -> ${err.message}`);
    }
  }

  console.log("");
  console.log(`Summary -> created: ${created}, skipped: ${skipped.length}, failed: ${failures.length}`);

  if (failures.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const { company, error } of failures) {
      console.log(`  ${company.name} (${company.id}): ${error.message}`);
    }
    process.exitCode = 1;
  }

  console.log("");
  console.log("Done. No Company row was modified.");
  console.log("");
}

main()
  .catch((err) => {
    console.error("backfillSubscriptions failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });