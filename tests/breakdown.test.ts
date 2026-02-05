import { describe, it, expect } from "vitest";
import { calculateVatBreakdown } from "../src/breakdown";
import type { RawItem } from "../src/types";

describe("calculateVatBreakdown", () => {
  it("computes basic 20% VAT breakdown", () => {
    const items: RawItem[] = [
      { price: 12, ust: 20, quantity: 2 },
      { price: 24, ust: 20, quantity: 1 },
    ];
    const result = calculateVatBreakdown(items);

    // netto per unit: 12/1.2 = 10, 24/1.2 = 20
    // netto20 = 10×2 + 20×1 = 40
    // vat20 = 40 × 0.2 = 8
    expect(result.netto20).toBe(40);
    expect(result.vat20).toBe(8);
    expect(result.netto10).toBe(0);
    expect(result.vat10).toBe(0);
    expect(result.totalBrutto).toBe(48);
    expect(result.tipTotal).toBe(0);
    expect(result.grandTotal).toBe(48);
  });

  it("computes mixed 10% and 20% VAT", () => {
    const items: RawItem[] = [
      { price: 12, ust: 20, quantity: 1 }, // netto = 10
      { price: 11, ust: 10, quantity: 1 }, // netto = 10
    ];
    const result = calculateVatBreakdown(items);

    expect(result.netto20).toBe(10);
    expect(result.netto10).toBe(10);
    expect(result.vat20).toBe(2);
    expect(result.vat10).toBe(1);
    expect(result.totalNetto).toBe(20);
    expect(result.totalVat).toBe(3);
    expect(result.totalBrutto).toBe(23);
  });

  it("handles tips (0% VAT) separately (fixes BUG 4)", () => {
    const items: RawItem[] = [
      { price: 12, ust: 20, quantity: 1 },
      { price: 5, ust: 0, quantity: 1 }, // tip
    ];
    const result = calculateVatBreakdown(items);

    // tip should NOT land in 20% bucket
    expect(result.netto20).toBe(10); // only the 12€ item
    expect(result.vat20).toBe(2);
    expect(result.tipTotal).toBe(5);
    expect(result.grandTotal).toBe(17); // 12 + 5
  });

  it("handles multiple tips correctly (BUG 2 scenario)", () => {
    const items: RawItem[] = [
      { price: 12, ust: 20, quantity: 1 },
      { price: 5, ust: 0, quantity: 1 },
      { price: 3, ust: 0, quantity: 1 },
    ];
    const result = calculateVatBreakdown(items);

    expect(result.tipTotal).toBe(8); // 5 + 3, not accumulated incorrectly
    expect(result.netto20).toBe(10);
    expect(result.grandTotal).toBe(20); // 12 + 8
  });

  it("adds shipping to 20% netto bucket", () => {
    const items: RawItem[] = [
      { price: 11, ust: 10, quantity: 1 }, // netto = 10
    ];
    const result = calculateVatBreakdown(items, { shippingCostNetto: 5 });

    expect(result.netto10).toBe(10);
    expect(result.vat10).toBe(1);
    // shipping goes to 20% bucket
    expect(result.netto20).toBe(5);
    expect(result.vat20).toBe(1); // 5 × 0.2
    expect(result.totalBrutto).toBe(17); // 10+1 + 5+1
  });

  it("applies discounts correctly", () => {
    const items: RawItem[] = [
      { price: 12, ust: 20, quantity: 1, discount: 50 },
    ];
    const result = calculateVatBreakdown(items);

    // netto = 12/1.2 = 10, discount 50% → netto after discount = 5
    expect(result.netto20).toBe(5);
    expect(result.vat20).toBe(1);
    expect(result.totalBrutto).toBe(6);
  });

  it("handles empty items list", () => {
    const result = calculateVatBreakdown([]);
    expect(result.netto10).toBe(0);
    expect(result.netto20).toBe(0);
    expect(result.vat10).toBe(0);
    expect(result.vat20).toBe(0);
    expect(result.totalBrutto).toBe(0);
    expect(result.grandTotal).toBe(0);
  });

  it("handles shipping only (no items)", () => {
    const result = calculateVatBreakdown([], { shippingCostNetto: 10 });
    expect(result.netto20).toBe(10);
    expect(result.vat20).toBe(2);
    expect(result.totalBrutto).toBe(12);
  });

  it("uses tva field (website compat)", () => {
    const items: RawItem[] = [{ price: 12, tva: 20, amount: 2 }];
    const result = calculateVatBreakdown(items);

    expect(result.netto20).toBe(20); // 10 × 2
    expect(result.vat20).toBe(4);
  });

  it("handles precision 2 (new default)", () => {
    const items: RawItem[] = [{ price: 12.5, ust: 10, quantity: 2 }];
    const result = calculateVatBreakdown(items, { precision: 2 });

    // netto per unit at precision 2: 12.5/1.1 = 11.3636... → 11.36
    // netto10 = 11.36 × 2 = 22.72
    // vat10 = 22.72 × 0.1 = 2.272 → 2.27
    expect(result.netto10).toBe(22.72);
    expect(result.vat10).toBe(2.27);
  });

  it("handles negative totals (Gutschrift / credit note)", () => {
    const items: RawItem[] = [{ price: -12, ust: 20, quantity: 1 }];
    const result = calculateVatBreakdown(items);

    // netto = -12/1.2 = -10
    expect(result.netto20).toBe(-10);
    expect(result.vat20).toBe(-2);
    expect(result.totalBrutto).toBe(-12);
  });

  it("handles 100% discount", () => {
    const items: RawItem[] = [
      { price: 12, ust: 20, quantity: 1, discount: 100 },
    ];
    const result = calculateVatBreakdown(items);

    expect(result.netto20).toBe(0);
    expect(result.vat20).toBe(0);
    expect(result.totalBrutto).toBe(0);
  });

  it("handles item with value field as quantity", () => {
    const items: RawItem[] = [{ price: 12, ust: 20, value: "3" }];
    const result = calculateVatBreakdown(items);

    expect(result.netto20).toBe(30); // 10 × 3
  });

  it("handles missing VAT field (defaults to 20%)", () => {
    const items: RawItem[] = [{ price: 12, quantity: 1 }];
    const result = calculateVatBreakdown(items);

    expect(result.netto20).toBe(10);
    expect(result.vat20).toBe(2);
  });
});
