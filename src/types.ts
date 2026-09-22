/**
 * Raw item as it comes from various projects.
 * Fields are optional because different projects use different naming conventions:
 * - VAT rate: `tva` (website, punsch-taxi cart) or `ust` (invoicepunschtaxi, punsch-taxi invoice)
 * - Quantity: `amount` (website, punsch-taxi cart), `quantity` (invoicepunschtaxi), or `value` (createRechnung)
 */
export interface RawItem {
  price: number;
  tva?: number | null;
  ust?: number | null;
  amount?: number | null;
  quantity?: number | null;
  value?: number | string | null;
  discount?: number | null;
  priceNetto?: number;
  inSumme?: boolean;
  name?: string;
  id?: number | string | null;
  pdfcategory?: { key: string } | null;
}

/**
 * Normalized item with consistent field names.
 */
export interface TaxableItem {
  price: number;
  vatRate: number;
  quantity: number;
  discount: number;
  priceNetto?: number;
}

export interface VatBreakdown {
  /** Netto subtotal for 10% items */
  netto10: number;
  /** Netto subtotal for 20% items (including shipping netto) */
  netto20: number;
  /** 10% tax amount */
  vat10: number;
  /** 20% tax amount */
  vat20: number;
  /** netto10 + netto20 */
  totalNetto: number;
  /** vat10 + vat20 */
  totalVat: number;
  /** totalNetto + totalVat */
  totalBrutto: number;
  /** Sum of 0% VAT items (Trinkgeld) */
  tipTotal: number;
  /** totalBrutto + tipTotal */
  grandTotal: number;
}

export interface NettoOptions {
  /** Decimal places for rounding (default: 2) */
  precision?: number;
  /** Apply discount on 'netto' (default) or 'brutto' before converting */
  discountOn?: "netto" | "brutto";
}

export interface BreakdownOptions {
  /** Delivery fee in netto (20% VAT applied). Explicitly netto to prevent confusion. */
  shippingCostNetto?: number;
  /** Decimal places for intermediate rounding (default: 2) */
  precision?: number;
}

export interface CartTotalsOptions {
  /** Netto delivery fee when shipping applies */
  deliveryFeeNetto: number;
  /**
   * Whether the free-shipping threshold may apply at all (default: true).
   * Callers pass false outside the free-delivery zone, where the fee is
   * charged whatever the cart is worth.
   */
  allowFreeDelivery?: boolean;
  /** Free-shipping multiplier applied to deliveryFeeNetto (default: 4) */
  freeDeliveryMultiplier?: number;
  /**
   * pdfcategory keys to exclude from the threshold check.
   * Items with a matching `pdfcategory.key` still count toward cartNetto
   * and the final breakdown, but not toward the free-shipping threshold.
   * Default: ["service-mitarbeiter", "personalkosten-speisen", "personalkosten-getranke"]
   */
  excludeFromThreshold?: string[];
  /** Rounding precision (default: 2) */
  precision?: number;
}

export interface CartTotals {
  /** Full VAT breakdown including shipping if applicable */
  breakdown: VatBreakdown;
  /** Items-only netto total (after inSumme filter, no shipping) */
  cartNetto: number;
  /** Netto total excluding worker products (used for threshold check) */
  cartNettoWithoutWorkers: number;
  /** Actual delivery fee applied (0 when free shipping) */
  deliveryFee: number;
  /** Whether the free-shipping threshold was met */
  freeShipping: boolean;
}
