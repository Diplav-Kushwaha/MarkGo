import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

/**
 * Idempotent seed of the built-in (system) Unit and Category rows that are
 * shared across every company. Safe to run many times: each built-in is found
 * by its natural key (shortName / name+type with isSystem = true) and updated
 * in place, or created if absent.
 *
 * Why not upsert by the composite unique key? The built-in rows have
 * companyId = NULL, and MySQL ignores NULLs inside a unique index, so
 * (companyId, shortName) cannot be used as an upsert key for system rows.
 * Resolving by shortName + isSystem avoids depending on that constraint.
 *
 * Run with:  npm run seed:catalog   (from the repository root)
 */

// Simple built-ins first; package units (Dozen) are resolved AFTER these.
const BUILTIN_SIMPLE_UNITS = [
  { fullName: "Piece", shortName: "pcs" },
  { fullName: "Kilogram", shortName: "kg" },
  { fullName: "Gram", shortName: "g" },
  { fullName: "Quintal", shortName: "qtl" },
  { fullName: "Tonne", shortName: "t" },
  { fullName: "Litre", shortName: "L" },
  { fullName: "Millilitre", shortName: "ml" },
  { fullName: "Meter", shortName: "m" },
  { fullName: "Centimeter", shortName: "cm" },
  { fullName: "Millimeter", shortName: "mm" },
  { fullName: "Foot", shortName: "ft" },
  { fullName: "Inch", shortName: "in" },
  { fullName: "Square Foot", shortName: "sq ft" },
  { fullName: "Square Meter", shortName: "sq m" },
  { fullName: "Pair", shortName: "pr" },
  { fullName: "Set", shortName: "set" },
  { fullName: "Hour", shortName: "hr" },
  { fullName: "Day", shortName: "day" },
  { fullName: "Visit", shortName: "visit" },
];

const BUILTIN_PACKAGE_UNITS = [
  // 1 Dozen = 12 Piece
  { fullName: "Dozen", shortName: "doz", quantity: 12, baseUnitShortName: "pcs" },
];

const BUILTIN_PRODUCT_CATEGORIES = [
  "Grocery",
  "Dairy",
  "Beverages",
  "Snacks",
  "Vegetables & Fruits",
  "Stationery",
  "Electronics",
  "Clothing",
  "Footwear",
  "Medicine & Pharmacy",
  "Cosmetics",
  "Hardware",
  "Furniture",
  "Household",
  "Toys",
];

const BUILTIN_SERVICE_CATEGORIES = [
  "Repair & Maintenance",
  "Cleaning",
  "Delivery & Transport",
  "Installation",
  "Consulting",
  "Labour",
  "Printing",
  "Design",
  "Rental",
];

async function seedUnits() {
  const byShortName = {};

  for (const def of BUILTIN_SIMPLE_UNITS) {
    const existing = await prisma.unit.findFirst({
      where: { isSystem: true, shortName: def.shortName },
    });

    const saved = existing
      ? await prisma.unit.update({
          where: { id: existing.id },
          data: {
            fullName: def.fullName,
            isPackage: false,
            quantity: null,
            baseUnitId: null,
          },
        })
      : await prisma.unit.create({
          data: {
            companyId: null,
            fullName: def.fullName,
            shortName: def.shortName,
            isSystem: true,
            isPackage: false,
            quantity: null,
            baseUnitId: null,
          },
        });

    byShortName[def.shortName] = saved.id;
  }

  for (const def of BUILTIN_PACKAGE_UNITS) {
    const baseId = byShortName[def.baseUnitShortName];
    if (!baseId) {
      throw new Error(
        `Seed: base unit "${def.baseUnitShortName}" not found for package "${def.shortName}".`
      );
    }

    const existing = await prisma.unit.findFirst({
      where: { isSystem: true, shortName: def.shortName },
    });

    if (existing) {
      await prisma.unit.update({
        where: { id: existing.id },
        data: {
          fullName: def.fullName,
          isPackage: true,
          quantity: def.quantity,
          baseUnitId: baseId,
        },
      });
    } else {
      await prisma.unit.create({
        data: {
          companyId: null,
          fullName: def.fullName,
          shortName: def.shortName,
          isSystem: true,
          isPackage: true,
          quantity: def.quantity,
          baseUnitId: baseId,
        },
      });
    }
  }

  console.log(`[seed:catalog] Built-in units upserted: ${BUILTIN_SIMPLE_UNITS.length} simple + ${BUILTIN_PACKAGE_UNITS.length} package.`);
}

async function seedCategories() {
  const productCount = BUILTIN_PRODUCT_CATEGORIES.length;
  const serviceCount = BUILTIN_SERVICE_CATEGORIES.length;

  for (const name of BUILTIN_PRODUCT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { isSystem: true, type: "PRODUCT", name },
    });
    if (existing) {
      await prisma.category.update({ where: { id: existing.id }, data: { name } });
    } else {
      await prisma.category.create({
        data: { companyId: null, name, type: "PRODUCT", isSystem: true },
      });
    }
  }

  for (const name of BUILTIN_SERVICE_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { isSystem: true, type: "SERVICE", name },
    });
    if (existing) {
      await prisma.category.update({ where: { id: existing.id }, data: { name } });
    } else {
      await prisma.category.create({
        data: { companyId: null, name, type: "SERVICE", isSystem: true },
      });
    }
  }

  console.log(`[seed:catalog] Built-in categories upserted: ${productCount} product + ${serviceCount} service.`);
}

async function main() {
  await seedUnits();
  await seedCategories();
  console.log("[seed:catalog] Done.");
}

main()
  .catch((err) => {
    console.error("[seed:catalog] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
