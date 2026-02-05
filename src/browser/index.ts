// Re-export delivery module (pure functions work in browser too)
export * from "../delivery";

// Browser-specific types
export type {
  GoogleMapsServiceConfig,
  DistanceMatrixOptions,
  PlaceResult,
  AddressSelectionOptions,
  AddressHandlerResult,
} from "./types";

// Google Maps service
export { GoogleMapsService, createGoogleMapsService } from "./google-maps-service";

// Address parsing
export { parseAddressComponents, parseNewPlacesApiDetails } from "./address-parser";

// Address handling
export {
  calculateDeliveryForAddress,
  handleAddressSelection,
  getOriginAddressFromResults,
} from "./address-handler";
