import type { AddressComponents, DeliveryOrigin, DistanceResult } from "../delivery/types";

/**
 * Configuration for GoogleMapsService
 */
export interface GoogleMapsServiceConfig {
  /** Google Maps API key (required for loading the API) */
  apiKey: string;
}

/**
 * Options for distance matrix query
 */
export interface DistanceMatrixOptions {
  /** Departure time for traffic calculation (default: DISTANCE_MATRIX_DEPARTURE_TIME) */
  departureTime?: Date;
  /** Whether to avoid highways (default: false) */
  avoidHighways?: boolean;
  /** Whether to avoid tolls (default: false) */
  avoidTolls?: boolean;
}

/**
 * Location that can be either function-based (Google Maps API) or plain object
 */
export interface PlaceLocationFunction {
  lat: () => number;
  lng: () => number;
}

export interface PlaceLocationObject {
  lat: number;
  lng: number;
}

export type PlaceLocation = PlaceLocationFunction | PlaceLocationObject;

/**
 * Raw Google Place result structure (subset of fields we use)
 */
export interface PlaceResult {
  geometry?: {
    location: PlaceLocation;
  };
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  formatted_address?: string;
}

/**
 * Options for handling address selection
 */
export interface AddressSelectionOptions {
  /** Whether to calculate delivery prices (default: true) */
  calculatePrices?: boolean;
  /** Origins to calculate distances from */
  origins?: DeliveryOrigin[];
  /** Whether cart has liveshowcooking products (affects origin selection) */
  hasLiveshowcookingProducts?: boolean;
  /** Whether to validate street number presence (default: true) */
  validateStreetNumber?: boolean;
}

/**
 * Result of address selection including calculated delivery info
 */
export interface AddressHandlerResult {
  addressComponents: AddressComponents;
  distanceResults: DistanceResult[];
  deliveryPrices?: {
    single: number;
    double: number;
    calculationDetails: {
      totalDistanceKm: number;
      totalDuration: number;
      driverCost: number;
      vehicleCost: number;
    };
  };
  selectedOrigin?: DeliveryOrigin;
  originsArray?: unknown[];
}
