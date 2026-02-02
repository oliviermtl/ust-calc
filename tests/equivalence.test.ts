import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { getNettoPrice, calculateVatBreakdown } from "../src";

/**
 * Equivalence tests: reproduce exact output of the three existing algorithms
 * and document divergences from the new canonical Algorithm A.
 */

// Simulate the existing js-big-decimal behavior (returns string, round half up).
function legacyBigDecimalRound(value: number, dp: number): string {
  return new Decimal(value)
    .toDecimalPlaces(dp, Decimal.ROUND_HALF_UP)
    .toFixed(dp);
}

describe("Algorithm equivalence", () => {
  describe("Algorithm A (netto-first) — canonical", () => {
    it("matches existing getNettoPrice at precision 2", () => {
      const testCases = [
        { price: 12.5, ust: 10, expected: 11.36 },
        { price: 15.9, ust: 10, expected: 14.45 },
        { price: 24, ust: 20, expected: 20 },
        { price: 7.5, ust: 20, expected: 6.25 },
        { price: 3.9, ust: 10, expected: 3.55 },
      ];

      for (const tc of testCases) {
        const result = getNettoPrice(
          { price: tc.price, ust: tc.ust },
          { precision: 2 },
        );
        // Verify it matches what bigDecimal.round(price/(ust/100+1), 2) produces
        const legacy = Number(
          legacyBigDecimalRound(tc.price / (tc.ust / 100 + 1), 2),
        );
        expect(result).toBe(legacy);
        expect(result).toBe(tc.expected);
      }
    });
  });

  describe("Algorithm B (brutto-then-divide) divergence", () => {
    it("documents rounding difference with Algorithm A", () => {
      // Two items at €12.50 brutto / 10% UST
      const items = [
        { price: 12.5, ust: 10, quantity: 1 },
        { price: 12.5, ust: 10, quantity: 1 },
      ];

      // Algorithm A (our canonical): per-item netto then sum
      const resultA = calculateVatBreakdown(items, { precision: 2 });
      // netto/item = round(12.5/1.1, 2) = 11.36
      // total netto = 11.36 × 2 = 22.72
      // VAT = 22.72 × 0.1 = 2.272 → 2.27
      expect(resultA.netto10).toBe(22.72);
      expect(resultA.vat10).toBe(2.27);

      // Algorithm B: sum brutto then divide
      const totalBrutto = 25.0;
      const nettoB = Number(
        new Decimal(totalBrutto)
          .div(new Decimal(1.1))
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toFixed(2),
      );
      const vatB = Number(
        new Decimal(totalBrutto)
          .minus(nettoB)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toFixed(2),
      );
      expect(nettoB).toBe(22.73);
      expect(vatB).toBe(2.27);

      // Divergence: netto differs by €0.01
      expect(resultA.netto10).not.toBe(nettoB);
      expect(Math.abs(resultA.netto10 - nettoB)).toBeCloseTo(0.01, 10);
      // VAT happens to match in this case
      expect(resultA.vat10).toBe(vatB);
    });

    it("documents VAT divergence with precision 2", () => {
      // Same test at precision 2
      const items = [
        { price: 12.5, ust: 10, quantity: 1 },
        { price: 12.5, ust: 10, quantity: 1 },
      ];

      const resultA = calculateVatBreakdown(items, { precision: 2 });
      // netto/item at p2 = round(12.5/1.1, 2) = 11.36
      // total netto = 22.72
      // VAT = 22.72 × 0.1 = 2.272 → 2.27
      expect(resultA.netto10).toBe(22.72);
      expect(resultA.vat10).toBe(2.27);

      // Algorithm B at precision 2: sum brutto then divide
      const totalBrutto = 25.0;
      const nettoB = Number(
        new Decimal(totalBrutto)
          .div(1.1)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toFixed(2),
      );
      // 25 / 1.1 = 22.7272... → 22.73
      expect(nettoB).toBe(22.73);
      const vatB = Number(
        new Decimal(totalBrutto)
          .minus(nettoB)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toFixed(2),
      );
      // Divergence: netto differs by €0.01
      expect(resultA.netto10).not.toBe(nettoB);
      expect(Math.abs(resultA.netto10 - nettoB)).toBeCloseTo(0.01, 10);
    });
  });

  describe("Algorithm C (per-item diff with stored priceNetto)", () => {
    it("documents behavior with stored priceNetto", () => {
      // createInvoice.js uses stored priceNetto (computed without rounding)
      // diff = discountedBrutto - discountedPriceNetto
      const price = 12.5;
      const ust = 10;
      const discount = 0;

      // Stored priceNetto (no rounding, as confhub createInvoice.ts does)
      const storedPriceNetto = price / (ust / 100 + 1); // 11.363636...

      // Algorithm C: diff = brutto - storedNetto (per item)
      const diff = price - storedPriceNetto; // 1.136363...
      // This is the TAX per item

      // Algorithm A: netto = round(12.5/1.1, 2) = 11.36
      // tax = 12.5 - 11.36 = 1.14
      const algoANetto = getNettoPrice({ price, ust }, { precision: 2 });
      const algoATax = price - algoANetto; // 1.14

      // Divergence: per-item tax differs
      expect(Number(diff.toFixed(4))).toBe(1.1364);
      expect(algoATax).toBeCloseTo(1.14, 10);
    });
  });

  describe("Discount equivalence", () => {
    it("discount on netto matches existing pattern", () => {
      // Existing: netto = round(price/(1+ust/100), 2)
      //           rabbat_price = round(netto × (1 - discount/100), 2)
      //           rabbat_value = round(netto - rabbat_price, 2)
      //           result = netto - rabbat_value
      const price = 24;
      const ust = 20;
      const discount = 15;

      // Legacy computation
      const legacyNetto = Number(
        legacyBigDecimalRound(price / (ust / 100 + 1), 2),
      ); // 20.0
      const legacyRabbatPrice = Number(
        legacyBigDecimalRound(legacyNetto * (1 - discount / 100), 2),
      ); // 17.0
      const legacyRabbatValue = Number(
        legacyBigDecimalRound(legacyNetto - legacyRabbatPrice, 2),
      ); // 3.0
      const legacyResult = legacyNetto - legacyRabbatValue; // 17.0

      // Our implementation
      const result = getNettoPrice({ price, ust, discount }, { precision: 2 });

      expect(result).toBe(legacyResult);
    });

    it("discount on netto with tricky rounding", () => {
      const price = 15.9;
      const ust = 10;
      const discount = 7;

      // Legacy at precision 2: netto = round(15.9/1.1, 2) = 14.45
      // rabbat_price = round(14.45 × 0.93, 2) = round(13.4385, 2) = 13.44
      // rabbat_value = round(14.45 - 13.44, 2) = 1.01
      // result = 14.45 - 1.01 = 13.44
      const legacyNetto = Number(legacyBigDecimalRound(15.9 / 1.1, 2));
      expect(legacyNetto).toBe(14.45);
      const legacyRabbatPrice = Number(
        legacyBigDecimalRound(14.45 * 0.93, 2),
      );
      expect(legacyRabbatPrice).toBe(13.44);
      const legacyRabbatValue = Number(
        legacyBigDecimalRound(14.45 - 13.44, 2),
      );
      const legacyResult = 14.45 - legacyRabbatValue;
      expect(legacyResult).toBe(13.44);

      const result = getNettoPrice({ price, ust, discount }, { precision: 2 });
      expect(result).toBe(13.44);
    });
  });

  describe("Shipping cost handling", () => {
    it("shipping netto adds to 20% bucket correctly", () => {
      const items = [
        { price: 11, ust: 10, quantity: 1 }, // netto = 10
      ];
      const result = calculateVatBreakdown(items, { shippingCostNetto: 8 });

      // 10% bucket: netto=10, vat=1
      // 20% bucket (shipping only): netto=8, vat=1.6
      expect(result.netto10).toBe(10);
      expect(result.vat10).toBe(1);
      expect(result.netto20).toBe(8);
      expect(result.vat20).toBe(1.6);
      expect(result.totalBrutto).toBe(20.6);
    });

    it("BUG 9 scenario: shipping should NOT be in brutto sum", () => {
      // In the old createRefund/createInvoice-cm, shipping (netto) was added to brutto sum.
      // Our fix: shippingCostNetto goes to netto bucket, VAT computed on it.
      const shippingNetto = 5;
      const result = calculateVatBreakdown([], {
        shippingCostNetto: shippingNetto,
      });

      // Correct: netto20 = 5, vat20 = 1, brutto = 6
      expect(result.netto20).toBe(5);
      expect(result.vat20).toBe(1);
      expect(result.totalBrutto).toBe(6);

      // Old bug would have: brutto = 5 (treated as brutto), netto = 5/1.2 = 4.17
      // Missing €0.83 of shipping value
    });
  });
});
