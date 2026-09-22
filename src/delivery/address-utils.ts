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

/** Lowest Vienna district postal code (1010 = 1. Bezirk). */
const VIENNA_ZIP_MIN = 1010;

/** Highest Vienna district postal code (1230 = 23. Bezirk). */
const VIENNA_ZIP_MAX = 1230;

/**
 * Whether a postal code belongs to a Vienna district.
 *
 * Only a bare four-digit code inside the district range counts. 1300 (Vienna
 * Airport) lies in Lower Austria and is excluded, and anything unparseable is
 * false: callers use this to grant a delivery discount, which must never fall
 * out of malformed input.
 */
export function isViennaPostalCode(zip: string | null | undefined): boolean {
  if (typeof zip !== "string") return false;

  const trimmed = zip.trim();
  if (!/^\d{4}$/.test(trimmed)) return false;

  const code = Number(trimmed);
  return code >= VIENNA_ZIP_MIN && code <= VIENNA_ZIP_MAX;
}
