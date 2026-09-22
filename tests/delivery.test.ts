import { describe, it, expect } from "vitest";
import {
  calculateDeliveryPrices,
  isViennaPostalCode,
  selectOptimalOrigin,
  selectOriginForProducts,
  isChristmasSeason,
  validateAddressHasStreetNumber,
  formatAddressForDisplay,
  buildShortAddress,
  createEmptyAddressComponents,
  DELIVERY_ORIGINS,
  DEFAULT_PRICE_CONFIG,
} from "../src/delivery";
import type { DistanceResult, AddressComponents } from "../src/delivery";

describe("DELIVERY_ORIGINS", () => {
  it("has correct Wien coordinates", () => {
    expect(DELIVERY_ORIGINS.wien.coordinates).toEqual({
      lat: 48.1923829,
      lng: 16.3294467,
    });
    expect(DELIVERY_ORIGINS.wien.name).toBe("Wien");
  });

  it("has correct St. Johann coordinates", () => {
    expect(DELIVERY_ORIGINS.stJohann.coordinates).toEqual({
      lat: 48.1007539,
      lng: 13.3162394,
    });
    expect(DELIVERY_ORIGINS.stJohann.name).toBe("St. Johann");
  });
});

describe("DEFAULT_PRICE_CONFIG", () => {
  it("has expected values", () => {
    expect(DEFAULT_PRICE_CONFIG.handlingTimeMinutes).toBe(30);
    expect(DEFAULT_PRICE_CONFIG.rateDriverPerHour).toBe(48);
    expect(DEFAULT_PRICE_CONFIG.gasCostPerLiter).toBe(1.5);
    expect(DEFAULT_PRICE_CONFIG.fuelConsumptionPer100Km).toBe(15);
  });
});

describe("calculateDeliveryPrices", () => {
  it("calculates prices for typical Vienna delivery", () => {
    // 10km one-way, 15 minutes one-way
    const result = calculateDeliveryPrices(10000, 900);

    // Round trip: 20km, 30min + 30min handling = 60min total
    // Driver cost: (48/60) * 60 = 48
    // Gas cost: 1.5 * 15/100 * 20 = 4.5
    // Total: 52.5 -> 53
    expect(result.single).toBe(53);
    expect(result.double).toBe(106);
    expect(result.calculationDetails.totalDistanceKm).toBe(20);
    expect(result.calculationDetails.totalDuration).toBe(60);
  });

  it("calculates prices for longer distance", () => {
    // 50km one-way, 45 minutes one-way
    const result = calculateDeliveryPrices(50000, 2700);

    // Round trip: 100km, 90min + 30min handling = 120min total
    // Driver cost: (48/60) * 120 = 96
    // Gas cost: 1.5 * 15/100 * 100 = 22.5
    // Total: 118.5 -> 119
    expect(result.single).toBe(119);
    expect(result.double).toBe(238);
    expect(result.calculationDetails.totalDistanceKm).toBe(100);
    expect(result.calculationDetails.totalDuration).toBe(120);
  });

  it("matches existing punsch-taxi-dashboard calculation", () => {
    // Real-world test case: 15km, 20min one-way
    // From calculatePriceByDistanceAndDuration.js
    const result = calculateDeliveryPrices(15000, 1200);

    // Round trip: 30km, 40min + 30min handling = 70min total
    // Driver cost: (48/60) * 70 = 56
    // Gas cost: 1.5 * 15/100 * 30 = 6.75
    // Total: 62.75 -> 63
    expect(result.single).toBe(63);
    expect(result.double).toBe(126);
  });

  it("handles custom config", () => {
    const result = calculateDeliveryPrices(10000, 900, {
      handlingTimeMinutes: 45,
      rateDriverPerHour: 60,
    });

    // Round trip: 20km, 30min + 45min handling = 75min total
    // Driver cost: (60/60) * 75 = 75
    // Gas cost: 1.5 * 15/100 * 20 = 4.5
    // Total: 79.5 -> 80
    expect(result.single).toBe(80);
  });

  it("handles zero distance", () => {
    const result = calculateDeliveryPrices(0, 0);

    // Only handling time: 30min
    // Driver cost: (48/60) * 30 = 24
    // Gas cost: 0
    // Total: 24
    expect(result.single).toBe(24);
  });

  it("bills fuel as price per litre x litres per 100km", () => {
    // 100km one-way with no driving time isolates the fuel term:
    // 200km round trip at 10 l/100km and 2 EUR/l = 20 litres per 100km
    // -> 200 * (2 * 10/100) = 40 EUR of fuel, plus 30min handling at 60 EUR/h.
    const result = calculateDeliveryPrices(100000, 0, {
      gasCostPerLiter: 2,
      fuelConsumptionPer100Km: 10,
      rateDriverPerHour: 60,
      handlingTimeMinutes: 30,
    });

    expect(result.calculationDetails.gasCost).toBe(40);
    expect(result.calculationDetails.driverCost).toBe(30);
    expect(result.single).toBe(70);
  });

  it("prices the Wien -> Traboch delivery behind quote 2569", () => {
    // 172.117km / 1h58 one-way from Jurekgasse 4, 1150 Wien.
    // Round trip: 344.234km, 265.6min. Driver: 212.48, fuel: 77.45.
    const result = calculateDeliveryPrices(172117, 7068);

    expect(result.single).toBe(290);
    expect(result.double).toBe(580);
  });
});

describe("isViennaPostalCode", () => {
  it("accepts every Vienna district code", () => {
    for (const zip of ["1010", "1020", "1100", "1150", "1220", "1230"]) {
      expect(isViennaPostalCode(zip)).toBe(true);
    }
  });

  it("rejects codes just outside the Vienna range", () => {
    expect(isViennaPostalCode("1009")).toBe(false);
    expect(isViennaPostalCode("1231")).toBe(false);
  });

  it("rejects Vienna airport, which is in Lower Austria", () => {
    expect(isViennaPostalCode("1300")).toBe(false);
  });

  it("rejects codes elsewhere in Austria", () => {
    expect(isViennaPostalCode("8772")).toBe(false); // Traboch
    expect(isViennaPostalCode("5242")).toBe(false); // St. Johann am Walde
    expect(isViennaPostalCode("2340")).toBe(false); // Mödling
  });

  it("rejects anything that is not a bare four-digit code", () => {
    // Free delivery is granted, never defaulted to: unusable input pays.
    expect(isViennaPostalCode("1150 Wien")).toBe(false);
    expect(isViennaPostalCode("A-1150")).toBe(false);
    expect(isViennaPostalCode("")).toBe(false);
    expect(isViennaPostalCode("   ")).toBe(false);
    expect(isViennaPostalCode(null)).toBe(false);
    expect(isViennaPostalCode(undefined)).toBe(false);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isViennaPostalCode(" 1150 ")).toBe(true);
  });
});

describe("isChristmasSeason", () => {
  it("returns true for December dates", () => {
    expect(isChristmasSeason(new Date("2024-12-01"))).toBe(true);
    expect(isChristmasSeason(new Date("2024-12-15"))).toBe(true);
    expect(isChristmasSeason(new Date("2024-12-31"))).toBe(true);
  });

  it("returns true for January 1-15", () => {
    expect(isChristmasSeason(new Date("2025-01-01"))).toBe(true);
    expect(isChristmasSeason(new Date("2025-01-15"))).toBe(true);
  });

  it("returns false for January 16+", () => {
    expect(isChristmasSeason(new Date("2025-01-16"))).toBe(false);
    expect(isChristmasSeason(new Date("2025-01-31"))).toBe(false);
  });

  it("returns false for other months", () => {
    expect(isChristmasSeason(new Date("2024-06-15"))).toBe(false);
    expect(isChristmasSeason(new Date("2024-11-30"))).toBe(false);
  });
});

describe("selectOptimalOrigin", () => {
  const createMockResults = (
    wienDistance: number,
    stJohannDistance: number
  ): DistanceResult[] => [
    {
      origin: DELIVERY_ORIGINS.wien,
      distance: { text: `${wienDistance / 1000} km`, value: wienDistance },
      duration: { text: "30 mins", value: 1800 },
      status: "OK",
    },
    {
      origin: DELIVERY_ORIGINS.stJohann,
      distance: { text: `${stJohannDistance / 1000} km`, value: stJohannDistance },
      duration: { text: "45 mins", value: 2700 },
      status: "OK",
    },
  ];

  it("returns null for empty results", () => {
    expect(selectOptimalOrigin([])).toBeNull();
  });

  it("prefers Wien by default", () => {
    const results = createMockResults(50000, 30000); // St. Johann closer
    const selected = selectOptimalOrigin(results, { preferWien: true });

    expect(selected?.origin.name).toBe("Wien");
  });

  it("selects closest when useClosest is true", () => {
    const results = createMockResults(50000, 30000); // St. Johann closer
    const selected = selectOptimalOrigin(results, { useClosest: true });

    expect(selected?.origin.name).toBe("St. Johann");
  });

  it("always selects Wien during Christmas season", () => {
    const results = createMockResults(50000, 30000); // St. Johann closer
    const selected = selectOptimalOrigin(results, {
      useClosest: true, // Would normally pick St. Johann
      dateOverride: new Date("2024-12-15"),
    });

    expect(selected?.origin.name).toBe("Wien");
  });

  it("filters out invalid status results", () => {
    const results: DistanceResult[] = [
      {
        origin: DELIVERY_ORIGINS.wien,
        distance: { text: "N/A", value: 0 },
        duration: { text: "N/A", value: 0 },
        status: "NOT_FOUND",
      },
      {
        origin: DELIVERY_ORIGINS.stJohann,
        distance: { text: "30 km", value: 30000 },
        duration: { text: "30 mins", value: 1800 },
        status: "OK",
      },
    ];

    const selected = selectOptimalOrigin(results);
    expect(selected?.origin.name).toBe("St. Johann");
  });
});

describe("selectOriginForProducts", () => {
  const createMockResults = (
    wienDistance: number,
    stJohannDistance: number
  ): DistanceResult[] => [
    {
      origin: DELIVERY_ORIGINS.wien,
      distance: { text: `${wienDistance / 1000} km`, value: wienDistance },
      duration: { text: "30 mins", value: 1800 },
      status: "OK",
    },
    {
      origin: DELIVERY_ORIGINS.stJohann,
      distance: { text: `${stJohannDistance / 1000} km`, value: stJohannDistance },
      duration: { text: "45 mins", value: 2700 },
      status: "OK",
    },
  ];

  it("prefers Wien for non-liveshowcooking products", () => {
    const results = createMockResults(50000, 30000);
    const selected = selectOriginForProducts(results, false);

    expect(selected?.origin.name).toBe("Wien");
  });

  it("uses closest for liveshowcooking products", () => {
    const results = createMockResults(50000, 30000);
    const selected = selectOriginForProducts(results, true);

    expect(selected?.origin.name).toBe("St. Johann");
  });
});

describe("validateAddressHasStreetNumber", () => {
  it("returns true for string with number", () => {
    expect(validateAddressHasStreetNumber("Stephansplatz 1")).toBe(true);
    expect(validateAddressHasStreetNumber("Jurekgasse 4, 1150 Wien")).toBe(true);
  });

  it("returns false for string without number", () => {
    expect(validateAddressHasStreetNumber("Stephansplatz")).toBe(false);
    expect(validateAddressHasStreetNumber("Kärntner Straße")).toBe(false);
  });

  it("returns true for AddressComponents with streetNumber", () => {
    const address: AddressComponents = {
      street: "Stephansplatz",
      streetNumber: "1",
      zip: "1010",
      city: "Wien",
      country: "Austria",
      state: "Wien",
      lat: 48.208174,
      lng: 16.373819,
      formatted: "Stephansplatz 1, 1010 Wien, Austria",
    };
    expect(validateAddressHasStreetNumber(address)).toBe(true);
  });

  it("returns false for AddressComponents without streetNumber", () => {
    const address: AddressComponents = {
      street: "Stephansplatz",
      streetNumber: "",
      zip: "1010",
      city: "Wien",
      country: "Austria",
      state: "Wien",
      lat: 48.208174,
      lng: 16.373819,
      formatted: "Stephansplatz, 1010 Wien, Austria",
    };
    expect(validateAddressHasStreetNumber(address)).toBe(false);
  });
});

describe("formatAddressForDisplay", () => {
  it("formats full address", () => {
    const address: AddressComponents = {
      street: "Stephansplatz",
      streetNumber: "1",
      zip: "1010",
      city: "Wien",
      country: "Austria",
      state: "Wien",
      lat: 0,
      lng: 0,
      formatted: "",
    };
    expect(formatAddressForDisplay(address)).toBe("Stephansplatz, 1, 1010, Wien");
  });

  it("handles missing components", () => {
    const address: AddressComponents = {
      street: "Stephansplatz",
      streetNumber: "",
      zip: "",
      city: "Wien",
      country: "Austria",
      state: "Wien",
      lat: 0,
      lng: 0,
      formatted: "",
    };
    expect(formatAddressForDisplay(address)).toBe("Stephansplatz, Wien");
  });
});

describe("buildShortAddress", () => {
  it("extracts city from secondary text", () => {
    expect(buildShortAddress("Stephansplatz 1", "1010 Wien, Austria")).toBe(
      "Stephansplatz 1 1010 Wien"
    );
  });

  it("handles multiple commas in secondary text", () => {
    expect(buildShortAddress("Kärtner Straße", "Vienna, Wien, Austria")).toBe(
      "Kärtner Straße Vienna"
    );
  });
});

describe("createEmptyAddressComponents", () => {
  it("creates empty address object", () => {
    const empty = createEmptyAddressComponents();
    expect(empty.street).toBe("");
    expect(empty.streetNumber).toBe("");
    expect(empty.zip).toBe("");
    expect(empty.city).toBe("");
    expect(empty.country).toBe("");
    expect(empty.state).toBe("");
    expect(empty.lat).toBe(0);
    expect(empty.lng).toBe(0);
    expect(empty.formatted).toBe("");
  });
});
