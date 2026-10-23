import Decimal from "decimal.js";
import { normalizeItem } from "./normalize";
import { getBruttoPrice } from "./core";
import type { RawItem, VatBreakdown, BruttoBreakdownOptions } from "./types";

const CENT_PLACES = 2;
const SHIPPING_VAT_RATE = 20;

const roundToCents = (value: Decimal) =>
  value.toDecimalPlaces(CENT_PLACES, Decimal.ROUND_HALF_UP);

/**
 * A line's brutto: the unit brutto `getBruttoPrice` prints (a discounted unit
 * rounded to the cent) times the quantity, so the breakdown matches the lines.
 */
function lineBrutto(item: RawItem, quantity: number): Decimal {
  return new Decimal(getBruttoPrice(item)).times(quantity);
}

/** Split one rate's brutto into netto and USt that add back up to the cent. */
function splitBrutto(brutto: Decimal, vatRate: number) {
  const roundedBrutto = roundToCents(brutto);
  const netto = roundToCents(roundedBrutto.div(new Decimal(1).plus(vatRate / 100)));
  return { brutto: roundedBrutto, netto, vat: roundedBrutto.minus(netto) };
}

/**
 * Compute an Austrian VAT breakdown brutto-first.
 *
 * Item prices are brutto, so each rate's lines are summed as brutto, rounded
 * to the cent once, and only then split into netto and USt. Netto + USt
 * therefore always equals the summed brutto — the amount the customer pays.
 *
 * `calculateVatBreakdown` rounds each unit's netto first instead, which drifts
 * by a cent every few units (24 × €6.50 → 130.08 + 26.02 = 156.10). The two
 * also differ on a discounted line: this one takes the discount off the unit
 * brutto, `calculateVatBreakdown` (default `discountOn: "netto"`) off the unit
 * netto, so 3 × €9.99 at 15% off is 25.47 here and 25.48 there. A caller whose
 * totals are checked against the other side (the invoice API re-prices the
 * sites' carts) must switch together with that side.
 *
 * Buckets: 20% (also any rate that isn't 10% or 0%, split at 20%), 10%, and
 * 0% (tips). A line without a numeric price or quantity is skipped.
 * A positive `shippingCostNetto` joins the 20% bucket at its exact brutto; a fee
 * given in fractions of a cent may print a cent away from the netto passed in.
 *
 * Items should already be filtered (e.g. `inSumme === true`) before passing here.
 */
export function calculateBruttoVatBreakdown(
  items: RawItem[],
  options: BruttoBreakdownOptions = {}
): VatBreakdown {
  const { shippingCostNetto = 0 } = options;

  let brutto10 = new Decimal(0);
  let brutto20 = new Decimal(0);
  let tipTotal = new Decimal(0);

  for (const item of items) {
    if (!item) continue;
    const normalized = normalizeItem(item);
    // A line without a numeric price or quantity adds nothing, as in getNettoPrice.
    if (!Number.isFinite(Number(item.price)) || !Number.isFinite(normalized.quantity)) continue;
    const brutto = lineBrutto({ ...item, price: Number(item.price) }, normalized.quantity);

    if (normalized.vatRate === 0) {
      tipTotal = tipTotal.plus(brutto);
    } else if (normalized.vatRate === 10) {
      brutto10 = brutto10.plus(brutto);
    } else {
      brutto20 = brutto20.plus(brutto);
    }
  }

  if (shippingCostNetto > 0) {
    brutto20 = brutto20.plus(
      new Decimal(shippingCostNetto).times(1 + SHIPPING_VAT_RATE / 100)
    );
  }

  const rate10 = splitBrutto(brutto10, 10);
  const rate20 = splitBrutto(brutto20, SHIPPING_VAT_RATE);
  const finalTip = roundToCents(tipTotal);
  const totalBrutto = rate10.brutto.plus(rate20.brutto);

  return {
    netto10: rate10.netto.toNumber(),
    netto20: rate20.netto.toNumber(),
    vat10: rate10.vat.toNumber(),
    vat20: rate20.vat.toNumber(),
    totalNetto: rate10.netto.plus(rate20.netto).toNumber(),
    totalVat: rate10.vat.plus(rate20.vat).toNumber(),
    totalBrutto: totalBrutto.toNumber(),
    tipTotal: finalTip.toNumber(),
    grandTotal: totalBrutto.plus(finalTip).toNumber(),
  };
}
