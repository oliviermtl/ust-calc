/**
 * Raw item as it comes from various projects.
 * Fields are optional because different projects use different naming conventions:
 * - VAT rate: `tva` (confhub, punsch-taxi cart) or `ust` (invoicepunschtaxi, punsch-taxi invoice)
 * - Quantity: `amount` (confhub, punsch-taxi cart), `quantity` (invoicepunschtaxi), or `value` (createRechnung)
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
