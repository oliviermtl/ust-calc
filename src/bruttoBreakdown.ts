import Decimal from "decimal.js";
import { normalizeItem } from "./normalize";
import type { RawItem, TaxableItem, VatBreakdown, BruttoBreakdownOptions } from "./types";

const CENT_PLACES = 2;
const SHIPPING_VAT_RATE = 20;

const roundToCents = (value: Decimal) =>
  value.toDecimalPlaces(CENT_PLACES, Decimal.ROUND_HALF_UP);

/** A line's brutto, its discount taken off before any rounding. */
function lineBrutto({ price, quantity, discount }: TaxableItem): Decimal {
  const kept = new Decimal(1).minus(new Decimal(discount).div(100));
  return new Decimal(price).times(quantity).times(kept);
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
 * by a cent every few units (24 × €6.50 → 130.08 + 26.02 = 156.10). Callers
 * that check totals against a cart built with it must keep using it until
 * both sides switch together.
 *
 * Buckets: 20% (also any rate that isn't 10% or 0%), 10%, and 0% (tips).
 * `shippingCostNetto` joins the 20% bucket at its exact brutto.
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
    const brutto = lineBrutto(normalized);

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
