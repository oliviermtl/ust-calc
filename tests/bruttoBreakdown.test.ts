import { describe, it, expect } from "vitest";
import { calculateBruttoVatBreakdown, calculateVatBreakdown, getBruttoPrice } from "../src";
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

  it("matches the discounted line brutto that getBruttoPrice prints", () => {
    // Unit 9.99 at 15% off = 8.4915 → 8.49; 7 × 8.49 = 59.43, not 7 × 8.4915 = 59.44.
    const item: RawItem = { price: 9.99, ust: 10, quantity: 7, discount: 15 };
    const result = calculateBruttoVatBreakdown([item]);

    expect(getBruttoPrice(item)).toBe(8.49);
    expect(result.totalBrutto).toBe(59.43);
    expect(result.netto10 + result.vat10).toBeCloseTo(59.43, 10);
  });

  it("matches getBruttoPrice × quantity for every discounted line", () => {
    for (const discount of [5, 7, 10, 15, 33, 50]) {
      for (const price of [3.9, 6.5, 9.99, 15.9, 29.5]) {
        for (const quantity of [1, 3, 7, 24]) {
          const item: RawItem = { price, ust: 20, quantity, discount };
          const expected = Math.round(getBruttoPrice(item) * quantity * 100);
          const result = calculateBruttoVatBreakdown([item]);

          expect(Math.round(result.totalBrutto * 100), `${quantity} × ${price} −${discount}%`)
            .toBe(expected);
        }
      }
    }
  });

  it("skips a line whose price or quantity is not a number", () => {
    const items = [
      { price: 6.5, ust: 20, quantity: 2 },
      { price: undefined, ust: 20, quantity: 1 },
      { price: Number.NaN, ust: 20, quantity: 1 },
      { price: 5, ust: 20, value: "abc" },
    ] as unknown as RawItem[];
    const result = calculateBruttoVatBreakdown(items);

    expect(result.totalBrutto).toBe(13);
    expect(result.netto20).toBe(10.83);
    expect(result.vat20).toBe(2.17);
    expect(result.grandTotal).toBe(13);
  });

  it("reads a string value as the quantity", () => {
    const result = calculateBruttoVatBreakdown([{ price: 6.5, ust: 20, value: "24" }]);

    expect(result.totalBrutto).toBe(156);
    expect(result.netto20).toBe(130);
  });

  it("splits a rate other than 10% or 0% at 20%", () => {
    const result = calculateBruttoVatBreakdown([{ price: 12, ust: 13, quantity: 1 }]);

    expect(result.netto20).toBe(10);
    expect(result.vat20).toBe(2);
    expect(result.netto10).toBe(0);
  });

  it("ignores a shipping netto of zero or below", () => {
    const items: RawItem[] = [{ price: 12, ust: 20, quantity: 1 }];

    for (const shippingCostNetto of [0, -5]) {
      const result = calculateBruttoVatBreakdown(items, { shippingCostNetto });
      expect(result.netto20).toBe(10);
      expect(result.totalBrutto).toBe(12);
    }
  });

  it("keeps the totals equal to the sum of their rates across mixed carts", () => {
    const toCents = (value: number) => Math.round(value * 100);
    const prices = [0.99, 3.9, 6.5, 9.5, 11.5, 15.9, 25.5, -1];
    for (let seed = 1; seed <= 400; seed++) {
      const items: RawItem[] = [
        { price: prices[seed % 8], ust: 20, quantity: (seed % 13) + 1 },
        { price: prices[(seed * 3) % 8], ust: 10, quantity: (seed % 7) + 1 },
        { price: prices[(seed * 5) % 8], ust: 20, quantity: (seed % 5) + 1, discount: seed % 20 },
        { price: 1, ust: 0, quantity: seed % 4 },
      ];
      const r = calculateBruttoVatBreakdown(items, { shippingCostNetto: seed % 3 === 0 ? 8.33 : 0 });
      const label = `seed ${seed}`;

      expect(toCents(r.totalNetto), label).toBe(toCents(r.netto10) + toCents(r.netto20));
      expect(toCents(r.totalVat), label).toBe(toCents(r.vat10) + toCents(r.vat20));
      expect(toCents(r.totalBrutto), label).toBe(toCents(r.totalNetto) + toCents(r.totalVat));
      expect(toCents(r.grandTotal), label).toBe(toCents(r.totalBrutto) + toCents(r.tipTotal));
    }
  });

  it("leaves calculateVatBreakdown's unit-netto totals unchanged", () => {
    const result = calculateVatBreakdown([{ price: 6.5, ust: 20, quantity: 24 }]);

    expect(result.netto20).toBe(130.08);
    expect(result.vat20).toBe(26.02);
  });
});
