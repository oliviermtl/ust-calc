import { DELIVERY_ORIGINS, DISTANCE_MATRIX_DEPARTURE_TIME } from "../delivery/constants";
import type { DeliveryOrigin, DistanceResult, LocationCoordinates } from "../delivery/types";
import type { DistanceMatrixOptions, GoogleMapsServiceConfig } from "./types";

/**
 * Service for interacting with Google Maps Distance Matrix API.
 * Manages API loading and provides distance calculations.
 */
export class GoogleMapsService {
  private config: GoogleMapsServiceConfig;
  private distanceMatrixService: google.maps.DistanceMatrixService | null = null;
  private apiLoadPromise: Promise<void> | null = null;

  constructor(config: GoogleMapsServiceConfig) {
    this.config = config;
  }

  private loadGoogleMapsApi(): Promise<void> {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("GoogleMapsService requires browser environment"));
    }

    if (window.google?.maps) {
      return Promise.resolve();
    }

    if (this.apiLoadPromise) {
      return this.apiLoadPromise;
    }

    this.apiLoadPromise = new Promise((resolve, reject) => {
      const callbackName = "__googleMapsCallback_" + Date.now();
      (window as unknown as Record<string, () => void>)[callbackName] = () => {
        delete (window as unknown as Record<string, unknown>)[callbackName];
        resolve();
      };

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.apiKey}&callback=${callbackName}`;
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load Google Maps API"));
      document.head.appendChild(script);
    });

    return this.apiLoadPromise;
  }

  private async ensureServicesInitialized(): Promise<void> {
    if (!window.google?.maps) {
      await this.loadGoogleMapsApi();
    }

    if (!this.distanceMatrixService) {
      this.distanceMatrixService = new google.maps.DistanceMatrixService();
    }
  }

  /**
   * Get distance matrix results for a destination from multiple origins.
   *
   * @param destination - Destination address or coordinates
   * @param origins - Array of origin configurations
   * @param options - Optional query options
   * @returns Array of distance results for each origin
   */
  async getDistanceMatrix(
    destination: LocationCoordinates | string,
    origins: DeliveryOrigin[] = [DELIVERY_ORIGINS.wien, DELIVERY_ORIGINS.stJohann],
    options: DistanceMatrixOptions = {}
  ): Promise<DistanceResult[]> {
    await this.ensureServicesInitialized();

    const {
      departureTime = DISTANCE_MATRIX_DEPARTURE_TIME,
      avoidHighways = false,
      avoidTolls = false,
    } = options;

    const destinationLatLng =
      typeof destination === "string"
        ? destination
        : new google.maps.LatLng(destination.lat, destination.lng);

    const results: DistanceResult[] = [];

    for (const origin of origins) {
      const result = await this.getDistanceMatrixForSingleOrigin(
        new google.maps.LatLng(origin.coordinates.lat, origin.coordinates.lng),
        destinationLatLng,
        origin,
        { departureTime, avoidHighways, avoidTolls }
      );
      results.push(result);
    }

    return results;
  }

  private getDistanceMatrixForSingleOrigin(
    origin: google.maps.LatLng,
    destination: google.maps.LatLng | string,
    originData: DeliveryOrigin,
    options: Required<DistanceMatrixOptions>
  ): Promise<DistanceResult> {
    return new Promise((resolve, reject) => {
      this.distanceMatrixService!.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: google.maps.TravelMode.DRIVING,
          drivingOptions: {
            departureTime: options.departureTime,
          },
          unitSystem: google.maps.UnitSystem.METRIC,
          avoidHighways: options.avoidHighways,
          avoidTolls: options.avoidTolls,
        },
        (response, status) => {
          if (status !== google.maps.DistanceMatrixStatus.OK) {
            reject(new Error(`Distance Matrix request failed: ${status}`));
            return;
          }

          const element = response?.rows[0]?.elements[0];

          if (!element) {
            reject(new Error("No distance matrix element in response"));
            return;
          }

          if (element.status === google.maps.DistanceMatrixElementStatus.OK) {
            resolve({
              origin: originData,
              distance: {
                text: element.distance.text,
                value: element.distance.value,
              },
              duration: {
                text: element.duration.text,
                value: element.duration.value,
              },
              status: element.status,
            });
          } else {
            resolve({
              origin: originData,
              distance: { text: "N/A", value: 0 },
              duration: { text: "N/A", value: 0 },
              status: element.status,
            });
          }
        }
      );
    });
  }

  /**
   * Build raw origins array for compatibility with legacy code.
   *
   * @param results - Distance results array
   * @param destination - Destination address string
   * @returns Array of raw response objects
   */
  buildOriginsArray(results: DistanceResult[], destination: string): unknown[] {
    return results.map((result) => ({
      rows: [
        {
          elements: [
            {
              status: result.status,
              distance: result.distance,
              duration: result.duration,
              duration_in_traffic: result.duration,
            },
          ],
        },
      ],
      originAddresses: [result.origin.address],
      destinationAddresses: [destination],
    }));
  }
}

/**
 * Create a GoogleMapsService instance with the given configuration.
 *
 * @param config - Service configuration with API key
 * @returns Configured GoogleMapsService instance
 */
export function createGoogleMapsService(
  config: GoogleMapsServiceConfig
): GoogleMapsService {
  return new GoogleMapsService(config);
}
