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
   * Fuel only: 1.50 EUR/l at 15 l/100km, the two figures this replaced. Tyres,
   * servicing and trailer wear are real per-kilometre costs and are knowingly
   * not billed — raising this was reverted as a business decision, not because
   * the number was wrong.
   */
  vehicleCostPerKm: 0.225,
};

/**
 * Fixed departure time for distance matrix queries
 * Using a far future date ensures consistent results regardless of when the query is made
 */
export const DISTANCE_MATRIX_DEPARTURE_TIME = new Date("2040-01-01");
