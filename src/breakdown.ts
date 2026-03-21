import Decimal from "decimal.js";
import { normalizeItem } from "./normalize";
import { getNettoPrice } from "./core";
import type {
  RawItem,
  VatBreakdown,
  BreakdownOptions,
  CartTotalsOptions,
  CartTotals,
} from "./types";

/**
 * Compute a full Austrian VAT breakdown from a list of items.
 *
 * Uses Algorithm A (netto-first):
 *   1. For each item, compute netto per unit via getNettoPrice (rounded to `precision` DP).
 *   2. Multiply by quantity to get line total netto.
 *   3. Group into three buckets: 20%, 10%, 0% (tips/tax-exempt).
 *   4. Sum each bucket. Add shipping (netto) to the 20% bucket.
 *   5. Compute VAT per bucket: nettoTotal × rate.
 *   6. Round final totals to 2 DP.
 *
 * This replaces all the ad-hoc ust20.reduce / ust10.reduce patterns across projects.
 *
 * Items should already be filtered (e.g. `inSumme === true`) before passing here.
 */
export function calculateVatBreakdown(
  items: RawItem[],
  options: BreakdownOptions = {}
): VatBreakdown {
  const { shippingCostNetto = 0, precision = 2 } = options;

  const d = (v: number) => new Decimal(v);

  let netto10 = d(0);
  let netto20 = d(0);
  let tipTotal = d(0);

  for (const item of items) {
    const normalized = normalizeItem(item);
    const { vatRate, quantity } = normalized;

    if (vatRate === 0) {
      // Tax-exempt items (Trinkgeld / tips).
      // For tips, netto === brutto. Apply discount if any.
      const nettoPerUnit = getNettoPrice(item, { precision });
      tipTotal = tipTotal.plus(d(nettoPerUnit).times(quantity));
      continue;
    }

    const nettoPerUnit = getNettoPrice(item, { precision });
    const lineNetto = d(nettoPerUnit).times(quantity);

    if (vatRate === 10) {
      netto10 = netto10.plus(lineNetto);
    } else {
      // Everything that isn't 10% or 0% goes into the 20% bucket.
      // This includes the standard 20% rate and any non-standard rates
      // (though in practice Austrian VAT is only 10% or 20%).
      netto20 = netto20.plus(lineNetto);
    }
  }

  // Add shipping to 20% netto bucket (shipping is always 20% VAT in Austria).
  if (shippingCostNetto > 0) {
    netto20 = netto20.plus(d(shippingCostNetto));
  }

  // Compute VAT amounts.
  const vat10 = netto10.times(d(0.1));
  const vat20 = netto20.times(d(0.2));

  // Round all final values to 2 DP.
  const finalNetto10 = netto10.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const finalNetto20 = netto20.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const finalVat10 = vat10.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const finalVat20 = vat20.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const finalTip = tipTotal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const totalNetto = finalNetto10.plus(finalNetto20);
  const totalVat = finalVat10.plus(finalVat20);
  const totalBrutto = totalNetto.plus(totalVat);
  const grandTotal = totalBrutto.plus(finalTip);

  return {
    netto10: finalNetto10.toNumber(),
    netto20: finalNetto20.toNumber(),
    vat10: finalVat10.toNumber(),
    vat20: finalVat20.toNumber(),
    totalNetto: totalNetto.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    totalVat: totalVat.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    totalBrutto: totalBrutto
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber(),
    tipTotal: finalTip.toNumber(),
    grandTotal: grandTotal
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber(),
  };
}

const DEFAULT_EXCLUDED_PDFCATEGORY_KEYS = [
  "service-mitarbeiter",
  "personalkosten-speisen",
  "personalkosten-getranke",
];

/**
 * Compute cart totals with free-shipping threshold logic.
 *
 * Higher-level wrapper around `calculateVatBreakdown` that:
 * 1. Filters items by `inSumme !== false` (billable items only).
 * 2. Computes items-only netto for the cart total.
 * 3. Checks the free-shipping threshold, optionally excluding
 *    worker/staff pdfcategory keys from the threshold calculation.
 * 4. Computes the final VAT breakdown with or without shipping.
 */
export function calculateCartTotals(
  items: RawItem[],
  options: CartTotalsOptions
): CartTotals {
  const {
    deliveryFeeNetto,
    freeDeliveryMultiplier = 4,
    excludeFromThreshold = DEFAULT_EXCLUDED_PDFCATEGORY_KEYS,
    precision = 2,
  } = options;

  // 1. Filter to billable items (inSumme !== false)
  const billableItems = items.filter((i) => i.inSumme !== false);

  // 2. Items-only breakdown (no shipping) for cartNetto
  const itemsOnly = calculateVatBreakdown(billableItems, { precision });
  const cartNetto = itemsOnly.totalNetto;

  // 3. Threshold check — exclude worker pdfcategory keys
  const excludeSet = new Set(excludeFromThreshold);
  const thresholdItems =
    excludeSet.size > 0
      ? billableItems.filter(
          (i) =>
            !i.pdfcategory?.key || !excludeSet.has(i.pdfcategory.key)
        )
      : billableItems;
  const thresholdBreakdown =
    thresholdItems.length !== billableItems.length
      ? calculateVatBreakdown(thresholdItems, { precision })
      : itemsOnly;
  const cartNettoWithoutWorkers = thresholdBreakdown.totalNetto;
  const freeDeliveryFrom = deliveryFeeNetto * freeDeliveryMultiplier;
  const freeShipping = cartNettoWithoutWorkers > freeDeliveryFrom;

  // 4. Final breakdown with shipping if applicable
  // Guard: no shipping when cart netto is negative (e.g. credit/refund carts)
  const deliveryFee =
    freeShipping || deliveryFeeNetto <= 0 || cartNetto < 0
      ? 0
      : deliveryFeeNetto;
  const breakdown =
    deliveryFee > 0
      ? calculateVatBreakdown(billableItems, {
          shippingCostNetto: deliveryFee,
          precision,
        })
      : itemsOnly;

  return {
    breakdown,
    cartNetto,
    cartNettoWithoutWorkers,
    deliveryFee,
    freeShipping,
  };
}
