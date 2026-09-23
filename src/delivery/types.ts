/**
 * Geographic coordinates (latitude/longitude)
 */
export interface LocationCoordinates {
  lat: number;
  lng: number;
}

/**
 * Delivery origin location configuration
 */
export interface DeliveryOrigin {
  name: string;
  address: string;
  coordinates: LocationCoordinates;
}

/**
 * Configuration object for delivery origins
 */
export interface DeliveryOriginConfig {
  wien: DeliveryOrigin;
  stJohann: DeliveryOrigin;
}

/**
 * Result from distance matrix calculation
 */
export interface DistanceResult {
  origin: DeliveryOrigin;
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  status: string;
}

/**
 * Calculated delivery prices
 */
export interface DeliveryPrices {
  single: number;
  double: number;
  calculationDetails: {
    totalDistanceKm: number;
    totalDuration: number;
    driverCost: number;
    vehicleCost: number;
  };
}

/**
 * Configuration for price calculation
 */
export interface PriceCalculationConfig {
  /** Time for handling/loading in minutes (default: 30) */
  handlingTimeMinutes: number;
  /** Driver rate per hour in EUR (default: 48) */
  rateDriverPerHour: number;
  /** Vehicle cost per km in EUR (default: 0.225) */
  vehicleCostPerKm: number;
}

/**
 * Parsed address components from Google Places
 */
export interface AddressComponents {
  street: string;
  streetNumber: string;
  zip: string;
  city: string;
  country: string;
  state: string;
  lat: number;
  lng: number;
  formatted: string;
}

/**
 * Options for origin selection
 */
export interface OriginSelectionOptions {
  /** Whether to prefer Wien origin (default: true unless liveshowcooking products) */
  preferWien?: boolean;
  /** Use closest origin regardless of preferences */
  useClosest?: boolean;
  /** Override christmas season check with this date */
  dateOverride?: Date;
}

/**
 * Result of address selection with delivery calculations
 */
export interface AddressSelectionResult {
  addressComponents: AddressComponents;
  distanceResults: DistanceResult[];
  deliveryPrices?: DeliveryPrices;
  selectedOrigin?: DeliveryOrigin;
  originsArray?: unknown[]; // Raw response array for compatibility
}
