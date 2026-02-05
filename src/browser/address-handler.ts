import { DELIVERY_ORIGINS } from "../delivery/constants";
import { calculateDeliveryPrices } from "../delivery/price-calculator";
import { selectOriginForProducts } from "../delivery/origin-selector";
import { validateAddressHasStreetNumber } from "../delivery/address-utils";
import type { AddressComponents, DeliveryOrigin, DistanceResult } from "../delivery/types";
import type { GoogleMapsService } from "./google-maps-service";
import { parseAddressComponents } from "./address-parser";
import type { AddressHandlerResult, AddressSelectionOptions, PlaceResult } from "./types";

/**
 * Calculate delivery information for an address.
 *
 * @param googleMapsService - Configured GoogleMapsService instance
 * @param addressComponents - Parsed address components
 * @param options - Calculation options
 * @returns Delivery calculation results
 */
export async function calculateDeliveryForAddress(
  googleMapsService: GoogleMapsService,
  addressComponents: AddressComponents,
  options: {
    origins?: DeliveryOrigin[];
    hasLiveshowcookingProducts?: boolean;
  } = {}
): Promise<
  Pick<
    AddressHandlerResult,
    "distanceResults" | "originsArray" | "selectedOrigin" | "deliveryPrices"
  >
> {
  const {
    origins = [DELIVERY_ORIGINS.wien, DELIVERY_ORIGINS.stJohann],
    hasLiveshowcookingProducts = false,
  } = options;

  const result: Pick<
    AddressHandlerResult,
    "distanceResults" | "originsArray" | "selectedOrigin" | "deliveryPrices"
  > = {
    distanceResults: [],
  };

  // Get distance matrix results
  const distanceResults = await googleMapsService.getDistanceMatrix(
    addressComponents,
    origins
  );

  result.distanceResults = distanceResults;

  // Build originsArray for compatibility
  result.originsArray = googleMapsService.buildOriginsArray(
    distanceResults,
    addressComponents.formatted
  );

  // Select optimal origin based on products
  const selectedResult = selectOriginForProducts(
    distanceResults,
    hasLiveshowcookingProducts
  );

  if (selectedResult) {
    result.selectedOrigin = selectedResult.origin;
    result.deliveryPrices = calculateDeliveryPrices(
      selectedResult.distance.value,
      selectedResult.duration.value
    );
  }

  return result;
}

/**
 * Handle address selection from Google Places.
 * Parses address, validates, and calculates delivery prices.
 *
 * @param googleMapsService - Configured GoogleMapsService instance
 * @param place - Google Places PlaceResult
 * @param options - Handler options
 * @returns Complete address selection result
 * @throws Error if address parsing fails or street number validation fails
 */
export async function handleAddressSelection(
  googleMapsService: GoogleMapsService,
  place: PlaceResult,
  options: AddressSelectionOptions = {}
): Promise<AddressHandlerResult> {
  const {
    calculatePrices = true,
    origins = [DELIVERY_ORIGINS.wien, DELIVERY_ORIGINS.stJohann],
    hasLiveshowcookingProducts = false,
    validateStreetNumber = true,
  } = options;

  // Extract address components
  const addressComponents = parseAddressComponents(place);

  if (!addressComponents) {
    throw new Error("Could not extract address components from selected place");
  }

  // Validate street number if required
  if (validateStreetNumber && !validateAddressHasStreetNumber(addressComponents)) {
    throw new Error("Please add a house number to your address");
  }

  const result: AddressHandlerResult = {
    addressComponents,
    distanceResults: [],
  };

  // Calculate distances if requested
  if (calculatePrices && origins.length > 0) {
    try {
      const deliveryData = await calculateDeliveryForAddress(
        googleMapsService,
        addressComponents,
        { origins, hasLiveshowcookingProducts }
      );
      Object.assign(result, deliveryData);
    } catch (error) {
      console.error("Failed to calculate delivery prices:", error);
      // Continue without prices - don't fail the entire selection
    }
  }

  return result;
}

/**
 * Get origin address info from distance matrix results (legacy compatibility).
 * This replicates the getOriginAddress function from punsch-taxi-dashboard.
 *
 * @param responseArr - Array of distance matrix responses
 * @param isDuringChristmasSeason - Whether we're in Christmas season
 * @returns Origin address info object
 * @throws "ADDRESS NOT_FOUND" if address lookup failed
 */
export function getOriginAddressFromResults(
  responseArr: Array<{
    rows: Array<{
      elements: Array<{
        status: string;
        distance?: { text: string; value: number };
        duration?: { text: string; value: number };
      }>;
    }>;
    originAddresses: string[];
    destinationAddresses: string[];
  }>,
  isDuringChristmasSeason: boolean
): {
  single: number;
  double: number;
  distance: string;
  distanceValue: number;
  duration: string;
  durationValue: number;
  originAddress: string;
  address: string;
} {
  if (!responseArr) {
    throw new Error("ADDRESS NOT_FOUND");
  }

  if (responseArr[0].rows[0].elements[0].status === "NOT_FOUND") {
    throw new Error("ADDRESS NOT_FOUND");
  }

  const fromWien = responseArr[0];
  const fromStJohann = responseArr[1];
  const distanceFromWien = fromWien.rows[0].elements[0].distance?.value ?? 0;
  const distanceFromStJohann = fromStJohann?.rows[0].elements[0].distance?.value ?? Infinity;

  const fromWhere = isDuringChristmasSeason
    ? fromWien
    : distanceFromWien < distanceFromStJohann
      ? fromWien
      : fromStJohann;

  const origins = fromWhere.originAddresses;
  const destinations = fromWhere.destinationAddresses;

  const originCity = fromWhere.originAddresses[0]?.includes("Wien")
    ? "Wien"
    : "St. Johann am Walde";

  let distanceKm = "";
  let durationText = "";
  let distanceValue = 0;
  let durationValue = 0;

  for (let i = 0; i < origins.length; i++) {
    const results = fromWhere.rows[i].elements;
    for (let j = 0; j < results.length; j++) {
      const element = results[j];
      distanceValue = element.distance?.value ?? 0;
      distanceKm = element.distance?.text ?? "";
      durationText = element.duration?.text ?? "";
      durationValue = element.duration?.value ?? 0;
    }
  }

  const { single, double } = calculateDeliveryPrices(distanceValue, durationValue);

  const tmpAdr = destinations[0].split(",", 2);

  return {
    single,
    double,
    distance: distanceKm,
    distanceValue,
    duration: durationText,
    durationValue,
    originAddress: originCity,
    address: tmpAdr.join(","),
  };
}
