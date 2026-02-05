import Decimal from "decimal.js";
import { DEFAULT_PRICE_CONFIG } from "./constants";
import type { DeliveryPrices, PriceCalculationConfig } from "./types";

/**
 * Calculate delivery prices based on distance and duration.
 *
 * Formula:
 * - Round trip distance and duration (multiply by 2)
 * - Add handling time to duration
 * - Driver cost = (rate per hour / 60) * total duration in minutes
 * - Gas cost = (cost per liter / consumption per 100km) * total distance in km
 * - Total = driver cost + gas cost
 *
 * @param distanceMeters - One-way distance in meters
 * @param durationSeconds - One-way duration in seconds
 * @param config - Optional custom configuration
 * @returns DeliveryPrices with single and double rates plus calculation details
 */
export function calculateDeliveryPrices(
  distanceMeters: number,
  durationSeconds: number,
  config?: Partial<PriceCalculationConfig>
): DeliveryPrices {
  const cfg = { ...DEFAULT_PRICE_CONFIG, ...config };

  // Use Decimal.js for precision (consistent with ust-calc patterns)
  const distanceM = new Decimal(distanceMeters);
  const durationS = new Decimal(durationSeconds);

  // Calculate round trip values
  const totalDurationMinutes = durationS
    .dividedBy(60)
    .times(2)
    .plus(cfg.handlingTimeMinutes);

  const totalDistanceKm = distanceM.times(2).dividedBy(1000);

  // Calculate costs
  const driverCost = new Decimal(cfg.rateDriverPerHour)
    .dividedBy(60)
    .times(totalDurationMinutes);

  const gasCost = new Decimal(cfg.gasCostPerLiter)
    .dividedBy(cfg.fuelConsumptionPer100Km)
    .times(totalDistanceKm);

  const costTotal = driverCost.plus(gasCost);

  return {
    single: costTotal.round().toNumber(),
    double: costTotal.times(2).round().toNumber(),
    calculationDetails: {
      totalDistanceKm: totalDistanceKm.toDecimalPlaces(2).toNumber(),
      totalDuration: totalDurationMinutes.toDecimalPlaces(2).toNumber(),
      driverCost: driverCost.toDecimalPlaces(2).toNumber(),
      gasCost: gasCost.toDecimalPlaces(2).toNumber(),
    },
  };
}
