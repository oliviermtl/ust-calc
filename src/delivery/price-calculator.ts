import Decimal from "decimal.js";
import { DEFAULT_PRICE_CONFIG } from "./constants";
import type { DeliveryPrices, PriceCalculationConfig } from "./types";

/**
 * Calculate delivery prices based on distance and duration.
 *
 * Formula:
 * - Round trip distance and duration (multiply by 2)
 * - Each leg takes at least `distance / maxAverageSpeedKmh`
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

  if (!(cfg.maxAverageSpeedKmh > 0)) {
    throw new Error(
      `maxAverageSpeedKmh must be a positive speed in km/h, got ${cfg.maxAverageSpeedKmh}. ` +
        "A zero or negative cap makes every leg take infinitely long.",
    );
  }

  // Use Decimal.js for precision (consistent with ust-calc patterns)
  const distanceM = new Decimal(distanceMeters);
  const durationS = new Decimal(durationSeconds);

  const oneWayKm = distanceM.dividedBy(1000);
  const totalDistanceKm = oneWayKm.times(2);

  // Google routes at car speed. Everything here travels loaded, and the
  // Estafette travels on a trailer — capped at 80 km/h by law and closer to 65
  // door to door once ramps, towns and hills are counted. So the routing
  // duration is a floor, not the truth, on anything that reaches an autobahn.
  // Taking the slower of the two leaves city runs alone: there Google is
  // already well under the trailer average.
  const minMinutesPerLeg = oneWayKm
    .dividedBy(cfg.maxAverageSpeedKmh)
    .times(60);
  const minutesPerLeg = Decimal.max(durationS.dividedBy(60), minMinutesPerLeg);

  const totalDurationMinutes = minutesPerLeg
    .times(2)
    .plus(cfg.handlingTimeMinutes);

  // Calculate costs
  const driverCost = new Decimal(cfg.rateDriverPerHour)
    .dividedBy(60)
    .times(totalDurationMinutes);

  // Not only fuel: tyres, brakes, servicing and trailer wear are per-kilometre
  // costs too, and they are what the old `gasCostPerLiter / consumption` term
  // left the business paying out of the margin.
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
