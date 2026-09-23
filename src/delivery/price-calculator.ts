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
 * - Vehicle cost = cost per km * total distance in km
 * - Total = driver cost + vehicle cost
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

  const totalDistanceKm = distanceM.times(2).dividedBy(1000);

  const totalDurationMinutes = durationS
    .dividedBy(60)
    .times(2)
    .plus(cfg.handlingTimeMinutes);

  // Calculate costs
  const driverCost = new Decimal(cfg.rateDriverPerHour)
    .dividedBy(60)
    .times(totalDurationMinutes);

  // One rate per kilometre, replacing the price-per-litre and litres-per-100km
  // pair: the two only ever appeared as their product, and splitting them
  // invited the division bug that undercharged fuel for two years.
  const vehicleCost = new Decimal(cfg.vehicleCostPerKm).times(totalDistanceKm);

  const costTotal = driverCost.plus(vehicleCost);

  return {
    single: costTotal.toDecimalPlaces(0).toNumber(),
    double: costTotal.toDecimalPlaces(0).times(2).toNumber(),
    calculationDetails: {
      totalDistanceKm: totalDistanceKm.toDecimalPlaces(0).toNumber(),
      totalDuration: totalDurationMinutes.toDecimalPlaces(0).toNumber(),
      driverCost: driverCost.toDecimalPlaces(0).toNumber(),
      vehicleCost: vehicleCost.toDecimalPlaces(0).toNumber(),
    },
  };
}

/**
 * The handling time a cart implies, in minutes.
 *
 * Loading a vehicle onto a trailer and strapping it down takes longer than
 * handing over a crate, so a product may declare its own handling time. All of
 * a cart's products share one trip and the slowest sets the pace, so this takes
 * the largest declared value — and never drops below the default, because the
 * base load and unload happens on every delivery whatever is in the van. A
 * product can therefore raise the floor but never lower it.
 *
 * @param declaredMinutes - Each item's own handling time; null or undefined for
 *   every product that has not declared one
 * @param defaultMinutes - The floor, defaulting to the shared config value
 * @returns The handling time to price the trip with
 */
export function resolveHandlingTimeMinutes(
  declaredMinutes: ReadonlyArray<number | null | undefined>,
  defaultMinutes: number = DEFAULT_PRICE_CONFIG.handlingTimeMinutes,
): number {
  return declaredMinutes.reduce<number>((longest, minutes) => {
    const value = Number(minutes);
    return Number.isFinite(value) && value > longest ? value : longest;
  }, defaultMinutes);
}
