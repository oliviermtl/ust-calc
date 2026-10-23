import { describe, it, expect } from "vitest";
import { calculateBruttoVatBreakdown, calculateVatBreakdown } from "../src";
import type { RawItem } from "../src/types";

describe("calculateBruttoVatBreakdown", () => {
  it("splits the line's brutto, not a rounded unit netto times quantity", () => {
    // 24 Punsch Gutscheine at €6.50: calculateVatBreakdown rounds the unit netto
    // (5.42 × 24) and prints netto 130.08 + USt 26.02 = 156.10 under a Summe of 156.00.
    const result = calculateBruttoVatBreakdown([{ price: 6.5, ust: 20, quantity: 24 }]);

    expect(result.netto20).toBe(130);
    expect(result.vat20).toBe(26);
    expect(result.totalBrutto).toBe(156);
    expect(result.grandTotal).toBe(156);
  });

  it("keeps netto + USt equal to the summed brutto for every rate", () => {
    const prices = [0.99, 3.9, 6.5, 9.5, 11.5, 12.5, 15.9, 25.5, 29.5, 42];
    const quantities = [1, 2, 3, 7, 24, 101];
    for (const ust of [10, 20]) {
      for (const price of prices) {
        for (const quantity of quantities) {
          const result = calculateBruttoVatBreakdown([{ price, ust, quantity }]);
          const brutto = Math.round(price * quantity * 100);
          const netto = ust === 10 ? result.netto10 : result.netto20;
          const vat = ust === 10 ? result.vat10 : result.vat20;
          const label = `${quantity} × ${price} @ ${ust}%`;

          expect(Math.round((netto + vat) * 100), label).toBe(brutto);
          expect(Math.round(result.totalBrutto * 100), label).toBe(brutto);
        }
      }
    }
  });

  it("sums each rate's lines before splitting off the USt", () => {
    const items: RawItem[] = [
      { price: 6.5, ust: 20, quantity: 3 },
      { price: 25.5, ust: 20, quantity: 1 },
      { price: 11.5, ust: 10, quantity: 5 },
      { price: -1, ust: 20, quantity: 4 },
    ];
    const result = calculateBruttoVatBreakdown(items);

    // 20%: 19.50 + 25.50 − 4.00 = 41.00 → netto 34.17, USt 6.83
    // 10%: 57.50 → netto 52.27, USt 5.23
    expect(result.netto20).toBe(34.17);
    expect(result.vat20).toBe(6.83);
    expect(result.netto10).toBe(52.27);
    expect(result.vat10).toBe(5.23);
    expect(result.totalNetto).toBe(86.44);
    expect(result.totalVat).toBe(12.06);
    expect(result.totalBrutto).toBe(98.5);
  });

  it("takes a discount off the brutto before splitting", () => {
    // 3 × 9.99 at 15% off = 25.4745 → 25.47 brutto → netto 23.15, USt 2.32
    const result = calculateBruttoVatBreakdown([
      { price: 9.99, ust: 10, quantity: 3, discount: 15 },
    ]);

    expect(result.netto10).toBe(23.15);
    expect(result.vat10).toBe(2.32);
    expect(result.totalBrutto).toBe(25.47);
  });

  it("keeps tips out of the taxed buckets", () => {
    const result = calculateBruttoVatBreakdown([
      { price: 6.5, ust: 20, quantity: 2 },
      { price: 1, ust: 0, quantity: 3 },
    ]);

    expect(result.totalBrutto).toBe(13);
    expect(result.tipTotal).toBe(3);
    expect(result.grandTotal).toBe(16);
  });

  it("adds shipping netto to the 20% bucket at its brutto", () => {
    const result = calculateBruttoVatBreakdown([{ price: 11, ust: 10, quantity: 1 }], {
      shippingCostNetto: 8,
    });

    expect(result.netto10).toBe(10);
    expect(result.vat10).toBe(1);
    expect(result.netto20).toBe(8);
    expect(result.vat20).toBe(1.6);
    expect(result.totalBrutto).toBe(20.6);
  });

  it("handles a credit note's negative lines and an empty list", () => {
    const credit = calculateBruttoVatBreakdown([{ price: -6.5, ust: 20, quantity: 24 }]);
    expect(credit.netto20).toBe(-130);
    expect(credit.vat20).toBe(-26);
    expect(credit.totalBrutto).toBe(-156);

    const empty = calculateBruttoVatBreakdown([]);
    expect(empty.totalBrutto).toBe(0);
    expect(empty.grandTotal).toBe(0);
  });

  it("leaves calculateVatBreakdown's unit-netto totals unchanged", () => {
    const result = calculateVatBreakdown([{ price: 6.5, ust: 20, quantity: 24 }]);

    expect(result.netto20).toBe(130.08);
    expect(result.vat20).toBe(26.02);
  });
});
