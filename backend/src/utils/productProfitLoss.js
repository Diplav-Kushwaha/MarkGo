import { toNumber } from "./money.js";

/**
 * Per-unit and per-stock profit / loss figures for a single product.
 *
 * Pure function: it takes a product row (Prisma model or plain object) and
 * returns numbers, so it is safe to call from the product detail endpoint, the
 * list serializer or any future invoice calculation without touching the
 * database.
 *
 * Tax handling
 * ------------
 * `sellingPriceTaxMode` and `purchasePriceTaxMode` describe how the stored
 * prices relate to tax:
 *   INCLUSIVE - the stored price already contains tax, so the base is
 *               price / (1 + r) and the tax is the remainder.
 *   EXCLUSIVE - tax is added on top, so the base is the price itself and the
 *               tax is price * r.
 *   NONE      - no tax is applied to that side.
 * `r` is the GST rate as a fraction (`taxRate / 100`).
 *
 * Discount handling
 * -----------------
 * `discountPercent` is applied to the selling base, and the output tax is
 * scaled to the discounted base so the tax always matches the money actually
 * collected. Cost is never discounted.
 */

function round2(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

export function calculateProductProfitLoss(product) {
  const sellingPrice = toNumber(product.salesPrice);
  const taxRate = toNumber(product.taxRate);
  const discountPercent = toNumber(product.discountPercent);
  const quantity = toNumber(product.stockQuantity);

  const sellingMode = product.sellingPriceTaxMode || "NONE";
  const r = taxRate / 100;

  // --- Selling side --------------------------------------------------------
  // INCLUSIVE: the stored price contains tax, so strip it to get the base.
  const sellingBase = sellingMode === "INCLUSIVE" ? sellingPrice / (1 + r) : sellingPrice;

  // Discount reduces the base, and the output tax follows the reduced base.
  const discountedSellingBase = sellingBase * (1 - discountPercent / 100);
  const sellingTax = sellingMode === "NONE" ? 0 : discountedSellingBase * r;

  const result = {
    hasCostPrice: false,
    sellingPrice,
    taxRate,
    discountPercent,
    quantity,
    sellingPriceTaxMode: sellingMode,
    perUnit: {
      sellingBase: round2(sellingBase),
      discountedSellingBase: round2(discountedSellingBase),
      sellingTax: round2(sellingTax),
    },
  };

  // Without a purchase price there is nothing to compare against, so the
  // response carries the selling figures only and no profit numbers.
  if (product.purchasePrice === null || product.purchasePrice === undefined) {
    return result;
  }

  // --- Cost side -----------------------------------------------------------
  const purchasePrice = toNumber(product.purchasePrice);
  const purchaseMode = product.purchasePriceTaxMode || "NONE";

  const costBase = purchaseMode === "INCLUSIVE" ? purchasePrice / (1 + r) : purchasePrice;
  const costTax =
    purchaseMode === "NONE"
      ? 0
      : purchaseMode === "INCLUSIVE"
        ? purchasePrice - costBase
        : purchasePrice * r;

  const profitBeforeTax = discountedSellingBase - costBase;
  const netTaxPayable = sellingTax - costTax;
  // Guard against dividing by a zero cost base.
  const marginPercent = costBase > 0 ? (profitBeforeTax / costBase) * 100 : 0;

  result.hasCostPrice = true;
  result.purchasePrice = purchasePrice;
  result.purchasePriceTaxMode = purchaseMode;
  result.perUnit = {
    ...result.perUnit,
    costBase: round2(costBase),
    costTax: round2(costTax),
    profitBeforeTax: round2(profitBeforeTax),
    netTaxPayable: round2(netTaxPayable),
    profitLossPerUnit: round2(profitBeforeTax),
    marginPercent: round2(marginPercent),
    isProfit: profitBeforeTax > 0,
  };

  // Totals are the per-unit figures scaled by the stock actually on hand.
  result.totals = {
    totalProfitLoss: round2(profitBeforeTax * quantity),
    totalSellingValue: round2(discountedSellingBase * quantity),
    totalCostValue: round2(costBase * quantity),
    totalSellingTax: round2(sellingTax * quantity),
    totalCostTax: round2(costTax * quantity),
  };

  return result;
}
