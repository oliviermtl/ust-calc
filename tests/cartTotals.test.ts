import { describe, it, expect } from "vitest";
import { calculateCartTotals } from "../src/breakdown";
import type { RawItem } from "../src/types";

const food20 = (price: number, qty: number): RawItem => ({
  price,
  ust: 20,
  quantity: qty,
  inSumme: true,
  pdfcategory: { key: "speisen" },
});

const food10 = (price: number, qty: number): RawItem => ({
  price,
  ust: 10,
  quantity: qty,
  inSumme: true,
  pdfcategory: { key: "speisen" },
});

const staffItem = (
  price: number,
  qty: number,
  key: string
): RawItem => ({
  price,
  ust: 20,
  quantity: qty,
  inSumme: true,
  pdfcategory: { key },
});

const tip = (price: number): RawItem => ({
  price,
  ust: 0,
  quantity: 1,
  inSumme: true,
  pdfcategory: { key: "trinkgeld" },
});

describe("calculateCartTotals", () => {
  describe("inSumme filtering", () => {
    it("excludes items with inSumme: false from breakdown", () => {
      const items: RawItem[] = [
        food20(12, 1),
        { ...food20(24, 1), inSumme: false },
      ];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 0,
      });

      // Only the 12€ item: netto = 10
      expect(result.cartNetto).toBe(10);
      expect(result.breakdown.totalBrutto).toBe(12);
    });

    it("includes items with inSumme: undefined (defaults to true)", () => {
      const items: RawItem[] = [
        { price: 12, ust: 20, quantity: 1 }, // no inSumme field
      ];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 0,
      });

      expect(result.cartNetto).toBe(10);
    });
  });

  describe("free shipping threshold", () => {
    it("charges delivery when cart netto below threshold", () => {
      // deliveryFee = 50, threshold = 50 * 4 = 200
      // cartNetto = 10 (below 200)
      const items: RawItem[] = [food20(12, 1)];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 50,
      });

      expect(result.freeShipping).toBe(false);
      expect(result.deliveryFee).toBe(50);
    });

    it("grants free shipping when cart netto exceeds threshold", () => {
      // deliveryFee = 10, threshold = 10 * 4 = 40
      // cartNetto = 10 * 5 = 50 (above 40)
      const items: RawItem[] = [food20(12, 5)];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 10,
      });

      expect(result.freeShipping).toBe(true);
      expect(result.deliveryFee).toBe(0);
    });

    it("does not grant free shipping when netto equals threshold exactly", () => {
      // deliveryFee = 10, threshold = 40
      // cartNetto = 10 * 4 = 40 (equal, not above)
      const items: RawItem[] = [food20(12, 4)];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 10,
      });

      expect(result.freeShipping).toBe(false);
      expect(result.deliveryFee).toBe(10);
    });

    it("uses custom freeDeliveryMultiplier", () => {
      // deliveryFee = 10, multiplier = 2, threshold = 20
      // cartNetto = 10 * 3 = 30 (above 20)
      const items: RawItem[] = [food20(12, 3)];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 10,
        freeDeliveryMultiplier: 2,
      });

      expect(result.freeShipping).toBe(true);
      expect(result.deliveryFee).toBe(0);
    });
  });

  describe("worker exclusion from threshold", () => {
    it("excludes personalkosten-speisen from threshold by default", () => {
      // Food netto = 10 (below threshold of 200)
      // Staff netto = 100 (excluded from threshold)
      const items: RawItem[] = [
        food20(12, 1),
        staffItem(120, 1, "personalkosten-speisen"),
      ];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 50,
      });

      // Threshold check uses only food: 10 < 200 → no free shipping
      expect(result.freeShipping).toBe(false);
      expect(result.deliveryFee).toBe(50);
      // But cartNetto includes staff
      expect(result.cartNetto).toBe(110);
      // cartNettoWithoutWorkers excludes staff
      expect(result.cartNettoWithoutWorkers).toBe(10);
    });

    it("excludes personalkosten-getranke from threshold by default", () => {
      const items: RawItem[] = [
        food20(12, 1),
        staffItem(120, 1, "personalkosten-getranke"),
      ];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 50,
      });

      expect(result.freeShipping).toBe(false);
      expect(result.cartNettoWithoutWorkers).toBe(10);
    });

    it("excludes service-mitarbeiter from threshold by default", () => {
      const items: RawItem[] = [
        food20(12, 1),
        staffItem(120, 1, "service-mitarbeiter"),
      ];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 50,
      });

      expect(result.freeShipping).toBe(false);
      expect(result.cartNettoWithoutWorkers).toBe(10);
    });

    it("includes staff in final breakdown even when excluded from threshold", () => {
      const items: RawItem[] = [
        food20(12, 1),
        staffItem(120, 1, "personalkosten-speisen"),
      ];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 50,
      });

      // Final breakdown includes staff + shipping
      // netto20 = 10 + 100 + 50 (shipping) = 160
      expect(result.breakdown.netto20).toBe(160);
    });

    it("allows custom excludeFromThreshold list", () => {
      const items: RawItem[] = [
        food20(12, 1),
        staffItem(120, 1, "personalkosten-speisen"),
      ];
      // Override to exclude nothing
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 10,
        excludeFromThreshold: [],
      });

      // Cart netto = 110, threshold = 40 → free shipping
      expect(result.freeShipping).toBe(true);
      expect(result.cartNettoWithoutWorkers).toBe(110);
    });

    it("handles items without pdfcategory (never excluded)", () => {
      const items: RawItem[] = [
        { price: 12, ust: 20, quantity: 1, inSumme: true },
      ];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 1,
      });

      // netto = 10, threshold = 4 → free shipping
      expect(result.freeShipping).toBe(true);
      expect(result.cartNettoWithoutWorkers).toBe(10);
    });
  });

  describe("shipping in breakdown", () => {
    it("includes shipping in breakdown when delivery fee applies", () => {
      const items: RawItem[] = [food20(12, 1)];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 50,
      });

      // netto20 = 10 (item) + 50 (shipping) = 60
      expect(result.breakdown.netto20).toBe(60);
      expect(result.breakdown.vat20).toBe(12);
      expect(result.breakdown.totalBrutto).toBe(72);
    });

    it("omits shipping from breakdown when free shipping", () => {
      const items: RawItem[] = [food20(12, 100)];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 10,
      });

      // netto20 = 1000 (items only, no shipping)
      expect(result.breakdown.netto20).toBe(1000);
      expect(result.deliveryFee).toBe(0);
    });
  });

  describe("negative cart netto guard", () => {
    it("forces deliveryFee to 0 when cart netto is negative", () => {
      const items: RawItem[] = [
        { price: -12, ust: 20, quantity: 1, inSumme: true },
      ];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 50,
      });

      expect(result.cartNetto).toBe(-10);
      expect(result.deliveryFee).toBe(0);
      // No shipping in breakdown
      expect(result.breakdown.netto20).toBe(-10);
    });
  });

  describe("deliveryFeeNetto edge cases", () => {
    it("handles deliveryFeeNetto of 0", () => {
      const items: RawItem[] = [food20(12, 1)];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 0,
      });

      expect(result.deliveryFee).toBe(0);
      expect(result.freeShipping).toBe(true);
    });

    it("handles negative deliveryFeeNetto", () => {
      const items: RawItem[] = [food20(12, 1)];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: -10,
      });

      expect(result.deliveryFee).toBe(0);
    });
  });

  describe("empty cart", () => {
    it("handles empty items list", () => {
      const result = calculateCartTotals([], {
        deliveryFeeNetto: 50,
      });

      expect(result.cartNetto).toBe(0);
      expect(result.cartNettoWithoutWorkers).toBe(0);
      // Empty cart still gets charged delivery (cartNetto 0 is not > threshold)
      expect(result.deliveryFee).toBe(50);
      expect(result.freeShipping).toBe(false);
      // Breakdown includes shipping: netto20 = 50, vat20 = 10
      expect(result.breakdown.totalBrutto).toBe(60);
    });
  });

  describe("mixed VAT rates", () => {
    it("handles 10% and 20% items with shipping", () => {
      const items: RawItem[] = [
        food20(12, 1), // netto = 10
        food10(11, 1), // netto = 10
      ];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 5,
      });

      expect(result.cartNetto).toBe(20);
      expect(result.deliveryFee).toBe(5);
      // shipping goes to 20% bucket
      expect(result.breakdown.netto10).toBe(10);
      expect(result.breakdown.netto20).toBe(15); // 10 + 5 shipping
    });
  });

  describe("tips handling", () => {
    it("tips do not affect cartNetto (ust:0 items return netto 0)", () => {
      // Known behavior: getNettoPrice returns 0 for ust:0 items
      // (see TODO in core.ts line 23). Tips are effectively zero in
      // the VAT breakdown. This test documents current behavior.
      const items: RawItem[] = [food20(12, 1), tip(5)];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 0,
      });

      expect(result.cartNetto).toBe(10);
      expect(result.breakdown.tipTotal).toBe(0);
      expect(result.breakdown.grandTotal).toBe(12);
    });
  });

  describe("precision", () => {
    it("respects custom precision", () => {
      const items: RawItem[] = [
        { price: 12.5, ust: 10, quantity: 2, inSumme: true },
      ];
      const result = calculateCartTotals(items, {
        deliveryFeeNetto: 0,
        precision: 2,
      });

      // netto per unit at precision 2: 12.5/1.1 = 11.36
      // netto10 = 11.36 × 2 = 22.72
      expect(result.breakdown.netto10).toBe(22.72);
    });
  });
});
