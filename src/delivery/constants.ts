import type { DeliveryOriginConfig, PriceCalculationConfig } from "./types";

/**
 * Delivery origin locations for Wien and St. Johann am Walde
 */
export const DELIVERY_ORIGINS: DeliveryOriginConfig = {
  wien: {
    name: "Wien",
    address: "Jurekgasse 4, 1150 Wien, Austria",
    coordinates: { lat: 48.1923829, lng: 16.3294467 },
  },
  stJohann: {
    name: "St. Johann",
    address: "Frauschereck 23, 5242 St. Johann am Walde, Austria",
    coordinates: { lat: 48.1007539, lng: 13.3162394 },
  },
};

/**
 * Default configuration for delivery price calculation
 */
export const DEFAULT_PRICE_CONFIG: PriceCalculationConfig = {
  handlingTimeMinutes: 30,
  rateDriverPerHour: 48,
  /**
   * Fuel for a rig towing the Estafette (~18 l/100km at 1.50 EUR/l) plus tyres,
   * brakes, servicing and trailer wear. Still below the Austrian amtliches
   * Kilometergeld of 0.50 EUR/km.
   */
  vehicleCostPerKm: 0.35,
  /**
   * A trailer is capped at 80 km/h by law and averages about 65 door to door,
   * once ramps, towns and hills are counted.
   */
  maxAverageSpeedKmh: 65,
};

/**
 * Fixed departure time for distance matrix queries
 * Using a far future date ensures consistent results regardless of when the query is made
 */
export const DISTANCE_MATRIX_DEPARTURE_TIME = new Date("2040-01-01");
