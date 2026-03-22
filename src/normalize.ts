import type { RawItem, TaxableItem } from "./types";

/**
 * Auto-detects field names across projects and produces a consistent TaxableItem.
 *
 * VAT rate: uses `ust ?? tva ?? defaultVatRate`.
 *   - Uses ?? (not ||) so that tva: 0 is correctly treated as tax-exempt (fixes BUG 5).
 *
 * Quantity: uses `quantity ?? amount ?? coerced(value) ?? 1`.
 *   - `value` can be a string in createRechnung data, so it's coerced to number.
 *
 * Discount: uses `discount ?? 0`, clamped to [0, 100].
 */
export function normalizeItem(
  raw: RawItem,
  defaultVatRate: number = 20
): TaxableItem {
  if (!raw) {
    return { price: 0, vatRate: defaultVatRate, quantity: 0, discount: 0 };
  }

  // VAT rate: prefer ust, fall back to tva, then default.
  // ?? ensures 0 is preserved (fixes BUG 5 where || treated 0 as falsy → 20%).
  const vatRate = raw.ust ?? raw.tva ?? defaultVatRate;

  // Quantity: prefer quantity, then amount, then value (coerced from string).
  let quantity: number;
  if (raw.quantity != null) {
    quantity = Number(raw.quantity);
  } else if (raw.amount != null) {
    quantity = Number(raw.amount);
  } else if (raw.value != null) {
    quantity = Number(raw.value);
  } else {
    quantity = 1;
  }

  // Clamp discount to [0, 100], default 0.
  const rawDiscount = raw.discount ?? 0;
  const discount = Math.max(0, Math.min(100, rawDiscount));

  return {
    price: raw.price,
    vatRate,
    quantity,
    discount,
    ...(raw.priceNetto != null ? { priceNetto: raw.priceNetto } : {}),
  };
}
