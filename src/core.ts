import Decimal from "decimal.js";
import { normalizeItem } from "./normalize";
import type { RawItem, NettoOptions } from "./types";

// Configure decimal.js for consistent behavior across all callers.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

/**
 * Compute the netto (ex-VAT) price of a single item.
 *
 * Algorithm A (netto-first):
 *   netto = brutto / (1 + vatRate/100), rounded to `precision` DP
 *   If discount: netto = netto × (1 − discount/100), rounded
 *
 * When `discountOn: 'brutto'`:
 *   discountedBrutto = brutto × (1 − discount/100)
 *   netto = discountedBrutto / (1 + vatRate/100), rounded
 *
 * @returns Netto price as a JS number (per single unit, NOT multiplied by quantity).
 */
export function getNettoPrice(item: RawItem, options: NettoOptions = {}): number {
  // Only a missing item or an unusable price yields 0.
  //
  // This guard deliberately does NOT test `item.ust`. Doing so treated three legitimate cases as
  // "no price": a tax-exempt item (`ust: 0` — tips are 0%-rated), an item carrying `tva` instead
  // of `ust` (customer-site payloads), and an item with no VAT field at all, which must default
  // to 20%. All three are resolved correctly by `normalizeItem` via `ust ?? tva ?? 20`, and the
  // tax-exempt branch below already handled `vatRate === 0` — the old guard made it dead code.
  //
  // The price check preserves the old behaviour for malformed input from JS callers: `RawItem`
  // types `price` as required, but an undefined price previously returned 0 here and would now
  // otherwise reach `new Decimal(undefined)`, which throws.
  if (!item || !Number.isFinite(Number(item.price))) return 0;

  const { precision = 2, discountOn = "netto" } = options;
  const normalized = normalizeItem(item);
  const { price, vatRate, discount } = normalized;

  const d = (v: number) => new Decimal(v);

  if (vatRate === 0) {
    // Tax-exempt: netto === brutto. Apply discount directly.
    if (discount > 0) {
      return d(price)
        .times(d(1).minus(d(discount).div(100)))
        .toDecimalPlaces(precision, Decimal.ROUND_HALF_UP)
        .toNumber();
    }
    return d(price).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toNumber();
  }

  const divisor = d(1).plus(d(vatRate).div(100));

  if (discountOn === "brutto" && discount > 0) {
    // Discount applied to brutto first, then convert to netto.
    const discountedBrutto = d(price).times(d(1).minus(d(discount).div(100)));
    return discountedBrutto.div(divisor).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP).toNumber();
  }

  // Standard: convert to netto, then apply discount on netto.
  const netto = d(price).div(divisor).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);

  if (discount > 0) {
    const discountedNetto = netto.times(d(1).minus(d(discount).div(100)));
    // Round the discount amount, then subtract (matches existing behavior).
    const discountAmount = netto.minus(discountedNetto).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
    return netto.minus(discountAmount).toNumber();
  }

  return netto.toNumber();
}

/**
 * Compute brutto from a netto value and VAT rate.
 *   brutto = netto × (1 + vatRate/100)
 */
export function getBruttoFromNetto(netto: number, vatRate: number = 20, precision: number = 2): number {
  return new Decimal(netto)
    .times(new Decimal(1).plus(new Decimal(vatRate).div(100)))
    .toDecimalPlaces(precision, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Compute the (possibly discounted) brutto price of an item.
 *   If discount > 0: brutto × (1 − discount/100), rounded
 *   Else: brutto as-is
 */
export function getBruttoPrice(item: RawItem, precision: number = 2): number {
  const normalized = normalizeItem(item);
  const { price, discount } = normalized;

  if (discount > 0) {
    return new Decimal(price)
      .times(new Decimal(1).minus(new Decimal(discount).div(100)))
      .toDecimalPlaces(precision, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  return price;
}
