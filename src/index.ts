export { normalizeItem } from "./normalize";
export { getNettoPrice, getBruttoFromNetto, getBruttoPrice } from "./core";
export { calculateVatBreakdown, calculateCartTotals } from "./breakdown";
export type {
  RawItem,
  TaxableItem,
  VatBreakdown,
  NettoOptions,
  BreakdownOptions,
  CartTotalsOptions,
  CartTotals,
} from "./types";

// Delivery module exports
export {
  // Constants
  DELIVERY_ORIGINS,
  DEFAULT_PRICE_CONFIG,
  DISTANCE_MATRIX_DEPARTURE_TIME,
  // Price calculation
  calculateDeliveryPrices,
  resolveHandlingTimeMinutes,
  // Origin selection
  isChristmasSeason,
  selectOptimalOrigin,
  selectOriginForProducts,
  // Address utilities
  validateAddressHasStreetNumber,
  formatAddressForDisplay,
  buildShortAddress,
  createEmptyAddressComponents,
  isViennaPostalCode,
} from "./delivery";

export type {
  LocationCoordinates,
  DeliveryOrigin,
  DeliveryOriginConfig,
  DistanceResult,
  DeliveryPrices,
  PriceCalculationConfig,
  AddressComponents,
  OriginSelectionOptions,
  AddressSelectionResult,
} from "./delivery";
