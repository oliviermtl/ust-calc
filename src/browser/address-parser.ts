import type { AddressComponents } from "../delivery/types";
import type { PlaceResult, PlaceLocation } from "./types";

/**
 * Extract coordinates from a PlaceLocation (handles both function and object forms)
 */
function extractCoordinates(location: PlaceLocation): { lat: number; lng: number } {
  if (typeof location.lat === "function") {
    return {
      lat: (location.lat as () => number)(),
      lng: (location.lng as () => number)(),
    };
  }
  return {
    lat: location.lat as number,
    lng: location.lng as number,
  };
}

/**
 * Parse address components from a Google Places PlaceResult.
 *
 * @param place - Google Places PlaceResult object
 * @returns Parsed address components, or null if required data is missing
 */
export function parseAddressComponents(
  place: PlaceResult
): AddressComponents | null {
  if (!place.geometry?.location || !place.address_components) {
    return null;
  }

  const components: Omit<AddressComponents, "lat" | "lng" | "formatted"> = {
    street: "",
    streetNumber: "",
    zip: "",
    city: "",
    country: "",
    state: "",
  };

  // Parse address components
  for (const component of place.address_components) {
    const types = component.types || [];

    if (types.includes("street_number")) {
      components.streetNumber = component.long_name;
    }
    if (types.includes("route")) {
      components.street = component.long_name;
    }
    if (types.includes("postal_code")) {
      components.zip = component.long_name;
    }
    if (types.includes("locality")) {
      components.city = component.long_name;
    }
    if (types.includes("administrative_area_level_1")) {
      components.state = component.long_name;
    }
    if (types.includes("country")) {
      components.country = component.long_name;
    }
  }

  // Get coordinates - handle both function and direct value forms
  const { lat, lng } = extractCoordinates(place.geometry.location);

  return {
    ...components,
    lat,
    lng,
    formatted: place.formatted_address || "",
  };
}

/**
 * Extract address components from the new Places API (P) response format.
 * Used with places-autocomplete-hook and similar libraries.
 *
 * @param details - Place details from getPlaceDetails
 * @returns Object with parsed address fields
 */
export function parseNewPlacesApiDetails(details: {
  city?: string;
  streetName?: string;
  postalCode?: string;
  streetNumber?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  displayName?: string;
  shortFormattedAddress?: string;
  formattedAddress?: string;
}): Partial<AddressComponents> & {
  types?: string[];
  displayName?: string;
  shortFormattedAddress?: string;
} {
  return {
    city: details.city ?? "",
    street: details.streetName ?? "",
    zip: details.postalCode ?? "",
    streetNumber: details.streetNumber ?? "",
    lat: details.location?.latitude ?? 0,
    lng: details.location?.longitude ?? 0,
    formatted: details.formattedAddress ?? "",
    types: details.types,
    displayName: details.displayName,
    shortFormattedAddress: details.shortFormattedAddress,
  };
}
