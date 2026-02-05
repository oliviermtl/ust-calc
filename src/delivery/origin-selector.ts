import type { DistanceResult, OriginSelectionOptions } from "./types";

/**
 * Check if a date falls within Christmas season (December 1 - January 15).
 *
 * During Christmas season, Wien origin is always preferred regardless of distance.
 *
 * @param date - Date to check (defaults to current date)
 * @returns true if date is within Christmas season
 */
export function isChristmasSeason(date: Date = new Date()): boolean {
  const month = date.getMonth(); // 0-indexed: 0 = January, 11 = December
  const day = date.getDate();

  // December (any day) or January 1-15
  return month === 11 || (month === 0 && day <= 15);
}

/**
 * Select the optimal delivery origin based on distance results and options.
 *
 * Logic:
 * 1. During Christmas season → always Wien
 * 2. No liveshowcooking products (preferWien = true) → Wien
 * 3. With liveshowcooking products (useClosest = true) → closest origin
 *
 * @param distanceResults - Array of distance results from different origins
 * @param options - Selection options
 * @returns The optimal distance result, or null if no valid results
 */
export function selectOptimalOrigin(
  distanceResults: DistanceResult[],
  options: OriginSelectionOptions = {}
): DistanceResult | null {
  const {
    preferWien = true,
    useClosest = false,
    dateOverride,
  } = options;

  if (!distanceResults.length) return null;

  // Filter valid results (status must be "OK")
  const validResults = distanceResults.filter((r) => r.status === "OK");

  if (!validResults.length) return null;

  // During Christmas season, always prefer Wien
  if (isChristmasSeason(dateOverride)) {
    const wienResult = validResults.find((r) => r.origin.name === "Wien");
    if (wienResult) return wienResult;
  }

  // If preferring Wien and not using closest
  if (preferWien && !useClosest) {
    const wienResult = validResults.find((r) => r.origin.name === "Wien");
    if (wienResult) return wienResult;
  }

  // Select the closest origin
  const wien = validResults.find((r) => r.origin.name === "Wien");
  const stJohann = validResults.find((r) => r.origin.name === "St. Johann");

  if (!wien) return stJohann || null;
  if (!stJohann) return wien;

  // Compare distances and return the closer one
  return wien.distance.value < stJohann.distance.value ? wien : stJohann;
}

/**
 * Convenience function to select origin for liveshowcooking products.
 * Uses closest origin instead of preferring Wien.
 *
 * @param distanceResults - Array of distance results from different origins
 * @param hasLiveshowcookingProducts - Whether cart contains liveshowcooking products
 * @param dateOverride - Optional date for christmas season check
 * @returns The optimal distance result, or null if no valid results
 */
export function selectOriginForProducts(
  distanceResults: DistanceResult[],
  hasLiveshowcookingProducts: boolean = false,
  dateOverride?: Date
): DistanceResult | null {
  return selectOptimalOrigin(distanceResults, {
    preferWien: !hasLiveshowcookingProducts,
    useClosest: hasLiveshowcookingProducts,
    dateOverride,
  });
}
