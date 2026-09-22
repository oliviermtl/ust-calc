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
 * - Gas cost = cost per liter * (consumption per 100km / 100) * total distance in km
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
  config?: Partial<PriceCalculationConfig>,
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

  // `fuelConsumptionPer100Km` is litres per 100km, so the litres burnt per
  // kilometre is consumption / 100. Dividing by the consumption instead only
  // ever matched at 10 l/100km, which is what the original dashboard formula
  // used; at the current 15 l/100km it undercharged fuel by a factor of 2.25.
  const gasCost = new Decimal(cfg.gasCostPerLiter)
    .times(new Decimal(cfg.fuelConsumptionPer100Km).dividedBy(100))
    .times(totalDistanceKm);

  const costTotal = driverCost.plus(gasCost);

  return {
    single: costTotal.toDecimalPlaces(0).toNumber(),
    double: costTotal.toDecimalPlaces(0).times(2).toNumber(),
    calculationDetails: {
      totalDistanceKm: totalDistanceKm.toDecimalPlaces(0).toNumber(),
      totalDuration: totalDurationMinutes.toDecimalPlaces(0).toNumber(),
      driverCost: driverCost.toDecimalPlaces(0).toNumber(),
      gasCost: gasCost.toDecimalPlaces(0).toNumber(),
    },
  };
}
