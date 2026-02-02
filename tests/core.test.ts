import { describe, it, expect } from "vitest";
import { getNettoPrice, getBruttoFromNetto, getBruttoPrice } from "../src/core";
import { normalizeItem } from "../src/normalize";

describe("normalizeItem", () => {
  it("detects ust field", () => {
    const item = normalizeItem({ price: 12, ust: 10, quantity: 2 });
    expect(item.vatRate).toBe(10);
    expect(item.quantity).toBe(2);
  });

  it("detects tva field", () => {
    const item = normalizeItem({ price: 12, tva: 10, amount: 3 });
    expect(item.vatRate).toBe(10);
    expect(item.quantity).toBe(3);
  });

  it("prefers ust over tva", () => {
    const item = normalizeItem({ price: 12, ust: 10, tva: 20 });
    expect(item.vatRate).toBe(10);
  });

  it("handles tva: 0 correctly (BUG 5 fix)", () => {
    // With ||, tva: 0 would become 20%. With ??, it stays 0.
    const item = normalizeItem({ price: 10, tva: 0 });
    expect(item.vatRate).toBe(0);
  });

  it("handles ust: 0 correctly", () => {
    const item = normalizeItem({ price: 10, ust: 0 });
    expect(item.vatRate).toBe(0);
  });

  it("uses default VAT rate when neither ust nor tva provided", () => {
    const item = normalizeItem({ price: 10 });
    expect(item.vatRate).toBe(20);
  });

  it("uses custom default VAT rate", () => {
    const item = normalizeItem({ price: 10 }, 10);
    expect(item.vatRate).toBe(10);
  });

  it("detects value field as quantity (string)", () => {
    const item = normalizeItem({ price: 12, ust: 20, value: "5" });
    expect(item.quantity).toBe(5);
  });

  it("detects value field as quantity (number)", () => {
    const item = normalizeItem({ price: 12, ust: 20, value: 5 });
    expect(item.quantity).toBe(5);
  });

  it("defaults quantity to 1", () => {
    const item = normalizeItem({ price: 12, ust: 20 });
    expect(item.quantity).toBe(1);
  });

  it("clamps discount to 0-100", () => {
    expect(normalizeItem({ price: 10, discount: -5 }).discount).toBe(0);
    expect(normalizeItem({ price: 10, discount: 150 }).discount).toBe(100);
    expect(normalizeItem({ price: 10, discount: 50 }).discount).toBe(50);
  });

  it("handles null discount", () => {
    expect(normalizeItem({ price: 10, discount: null }).discount).toBe(0);
  });

  it("preserves priceNetto if present", () => {
    const item = normalizeItem({ price: 12, ust: 20, priceNetto: 10 });
    expect(item.priceNetto).toBe(10);
  });
});

describe("getNettoPrice", () => {
  it("computes netto from brutto at 20% VAT, precision 2", () => {
    // 12.00 / 1.20 = 10.00
    expect(getNettoPrice({ price: 12, ust: 20 })).toBe(10);
  });

  it("computes netto from brutto at 10% VAT, precision 2", () => {
    // 11.00 / 1.10 = 10.00
    expect(getNettoPrice({ price: 11, ust: 10 })).toBe(10);
  });

  it("computes netto at precision 2 with 10% VAT", () => {
    // 12.50 / 1.10 = 11.3636... → rounds to 11.36 at 2 DP
    expect(getNettoPrice({ price: 12.5, ust: 10 }, { precision: 2 })).toBe(
      11.36,
    );
  });

  it("applies discount on netto (default)", () => {
    // netto = 12 / 1.2 = 10.00, discount 10%:
    // discountedNetto = 10 × 0.9 = 9.00
    // discountAmount = 10 - 9 = 1.00
    // result = 10 - 1.00 = 9.00
    expect(getNettoPrice({ price: 12, ust: 20, discount: 10 })).toBe(9);
  });

  it("applies discount on brutto first", () => {
    // discountedBrutto = 12 × 0.9 = 10.80
    // netto = 10.80 / 1.2 = 9.00
    expect(
      getNettoPrice(
        { price: 12, ust: 20, discount: 10 },
        { discountOn: "brutto" },
      ),
    ).toBe(9);
  });

  it("handles tax-exempt item (ust: 0)", () => {
    expect(getNettoPrice({ price: 10, ust: 0 })).toBe(10);
  });

  it("handles tax-exempt item with discount", () => {
    // 10 × 0.9 = 9
    expect(getNettoPrice({ price: 10, ust: 0, discount: 10 })).toBe(9);
  });

  it("matches existing js-big-decimal behavior at precision 2", () => {
    // 15.90 / 1.1 = 14.4545... → 14.45 at 2 DP
    expect(getNettoPrice({ price: 15.9, ust: 10 }, { precision: 2 })).toBe(
      14.45,
    );
  });

  it("handles discount matching existing pattern at precision 2", () => {
    // netto_price = round(24.00 / 1.2, 2) = 20.0
    // rabbat_price = round(20.0 × 0.9, 2) = 18.0
    // rabbat_value = round(20.0 - 18.0, 2) = 2.0
    // return 20.0 - 2.0 = 18.0
    expect(
      getNettoPrice({ price: 24, ust: 20, discount: 10 }, { precision: 2 }),
    ).toBe(18);
  });

  it("handles zero price", () => {
    expect(getNettoPrice({ price: 0, ust: 20 })).toBe(0);
  });

  it("uses tva field when ust is not present", () => {
    expect(getNettoPrice({ price: 12, tva: 20 })).toBe(10);
  });
});

describe("getBruttoFromNetto", () => {
  it("computes brutto from netto at 20%", () => {
    expect(getBruttoFromNetto(10, 20)).toBe(12);
  });

  it("computes brutto from netto at 10%", () => {
    expect(getBruttoFromNetto(10, 10)).toBe(11);
  });

  it("defaults to 20% VAT", () => {
    expect(getBruttoFromNetto(10)).toBe(12);
  });

  it("rounds to specified precision", () => {
    // 11.36 × 1.10 = 12.496 → 12.50
    expect(getBruttoFromNetto(11.36, 10, 2)).toBe(12.5);
  });
});

describe("getBruttoPrice", () => {
  it("returns price when no discount", () => {
    expect(getBruttoPrice({ price: 12, ust: 20 })).toBe(12);
  });

  it("applies discount to brutto", () => {
    // 12 × 0.9 = 10.80
    expect(getBruttoPrice({ price: 12, ust: 20, discount: 10 })).toBe(10.8);
  });

  it("rounds to specified precision", () => {
    // 15.90 × 0.85 = 13.515 → 13.5 at 1 DP
    expect(getBruttoPrice({ price: 15.9, ust: 20, discount: 15 }, 1)).toBe(
      13.5,
    );
  });
});
