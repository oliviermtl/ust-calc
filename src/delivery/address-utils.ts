import type { AddressComponents } from "./types";

/**
 * Validate that an address contains a street number.
 *
 * @param address - Address string or AddressComponents object
 * @returns true if address contains a street number
 */
export function validateAddressHasStreetNumber(
  address: string | AddressComponents
): boolean {
  // Check if address string contains a number
  if (typeof address === "string") {
    const hasNumber = /\d/.test(address);
    return hasNumber;
  }

  // Check if address components have street number
  return !!address.streetNumber && address.streetNumber.trim() !== "";
}

/**
 * Format address components for display.
 *
 * @param components - Parsed address components
 * @returns Formatted address string (e.g., "Stephansplatz, 1, 1010, Wien")
 */
export function formatAddressForDisplay(components: AddressComponents): string {
  const parts = [
    components.street,
    components.streetNumber,
    components.zip,
    components.city,
  ].filter(Boolean);

  return parts.join(", ");
}

/**
 * Build a short address from main and secondary text.
 * Extracts only the city from the secondary text.
 *
 * @param mainText - Main address text (e.g., "Stephansplatz 1")
 * @param secondaryText - Secondary text (e.g., "1010 Wien, Austria")
 * @returns Short address (e.g., "Stephansplatz 1 1010 Wien")
 */
export function buildShortAddress(
  mainText: string,
  secondaryText: string
): string {
  const cityOnly = secondaryText.split(",")[0];
  return `${mainText} ${cityOnly}`.trim();
}

/**
 * Create empty address components object.
 * Useful for initialization.
 */
export function createEmptyAddressComponents(): AddressComponents {
  return {
    street: "",
    streetNumber: "",
    zip: "",
    city: "",
    country: "",
    state: "",
    lat: 0,
    lng: 0,
    formatted: "",
  };
}
