# Plan: Unify Address Selection & Delivery Cost Calculations

## Overview

Harmonize address selection and delivery cost calculations between `punsch-taxi.at` and `punsch-taxi-dashboard` by extracting shared logic into `lib/ust-calc`.

## Current State Analysis

| Aspect | punsch-taxi.at | punsch-taxi-dashboard |
|--------|----------------|----------------------|
| Framework | TanStack Start (Vite) | Next.js 14 |
| Structure | Separate service files | Embedded in components |
| Origins | Wien + St. Johann | Wien + St. Johann (same) |
| Formula | 30min + €48/hr + €1.50/L | Identical |
| ust-calc | v1.1.0 (VAT only) | v1.1.0 (VAT only) |

### Source Files (punsch-taxi.at)
- `src/services/google-maps.service.ts` - Distance Matrix API wrapper
- `src/lib/address-selection-handler.ts` - Orchestration
- `src/lib/delivery-price-calculator.ts` - Price calculation
- `src/lib/address-utils.ts` - Address parsing utilities
- `src/types/google-maps.types.ts` - Type definitions

### Dashboard Files to Migrate
- `components/Quote/components/AddressField/PlacesAutocompleteNew.jsx` - Inline distance matrix
- `lib/calculatePriceByDistanceAndDuration.js` - Price formula
- `lib/utils.js` - `getOriginAddress()` function

---

## Recommended Approach: Layered Architecture

Expand `ust-calc` with clear separation between **pure functions** (framework-agnostic) and **browser code** (Google Maps dependent).

### Why This Approach?
- Single package to maintain
- Tree-shakeable - consumers import only what they need
- Pure functions easily testable
- Browser code isolated with dependency injection for API key
- Incremental migration possible

---

## Implementation Plan

### Phase 1: Add Pure Delivery Functions to ust-calc

**New file structure in `lib/ust-calc/src/`:**
```
delivery/
  index.ts           # Barrel exports
  types.ts           # DeliveryOrigin, DistanceResult, DeliveryPrices
  constants.ts       # DELIVERY_ORIGINS (Wien, St. Johann)
  price-calculator.ts # calculateDeliveryPrices (pure)
  origin-selector.ts  # selectOptimalOrigin (pure)
  address-utils.ts    # validateAddressHasStreetNumber, formatAddressForDisplay
```

**Files to create:**

1. **`src/delivery/types.ts`** - Type definitions
   - `LocationCoordinates`, `DeliveryOrigin`, `DistanceResult`
   - `DeliveryPrices`, `PriceCalculationConfig`, `AddressComponents`

2. **`src/delivery/constants.ts`** - Configuration
   - `DELIVERY_ORIGINS` (Wien: 48.1923829, 16.3294467 | St. Johann: 48.1007539, 13.3162394)
   - `DEFAULT_PRICE_CONFIG` (30min handling, €48/hr, €1.50/L, 15L/100km)

3. **`src/delivery/price-calculator.ts`** - Pure calculation
   - `calculateDeliveryPrices(distanceMeters, durationSeconds, config?)` → DeliveryPrices
   - Uses Decimal.js for precision (consistent with existing ust-calc pattern)

4. **`src/delivery/origin-selector.ts`** - Origin selection
   - `selectOptimalOrigin(distanceResults, options?)` → DistanceResult | null
   - Options: `preferWien`, `useClosest` (for liveshowcooking products)
   - `isChristmasSeason(date?)` → boolean (Dec 1 - Jan 15)
   - Christmas season logic: Always prefer Wien origin during December/January

5. **`src/delivery/address-utils.ts`** - Address utilities
   - `validateAddressHasStreetNumber(address)` → boolean
   - `formatAddressForDisplay(components)` → string
   - `buildShortAddress(mainText, secondaryText)` → string

6. **Update `src/index.ts`** - Add new exports

7. **`tests/delivery.test.ts`** - Unit tests + equivalence tests

### Phase 2: Add Browser-Specific Code (Separate Entry Point)

**New file structure:**
```
browser/
  index.ts              # Barrel exports for browser code
  types.ts              # Browser-specific types
  google-maps-service.ts # GoogleMapsService class
  address-parser.ts     # parseAddressComponents (PlaceResult → AddressComponents)
  address-handler.ts    # handleAddressSelection orchestration
```

**Key design decisions:**

1. **Dependency Injection for API Key**
   ```typescript
   import { createGoogleMapsService } from '@oliviermtlbali/ust-calc/browser'

   const service = createGoogleMapsService({
     apiKey: process.env.NEXT_PUBLIC_GOOGLEMAPAPI // or import.meta.env.VITE_*
   })
   ```

2. **Fixed Future Date for Distance Matrix**
   - Use `new Date('01-01-2040')` as departure time
   - Ensures consistent results regardless of when query is made

3. **Dual Entry Points in tsup.config.ts**
   ```typescript
   entry: {
     index: 'src/index.ts',      // Pure functions (Node + Browser)
     browser: 'src/browser/index.ts'  // Browser-only code
   }
   ```

4. **Package.json exports**
   ```json
   {
     ".": { "import": "./dist/index.mjs", "require": "./dist/index.js" },
     "./browser": { "import": "./dist/browser.mjs", "require": "./dist/browser.js" }
   }
   ```

### Phase 3: Migrate punsch-taxi-dashboard

1. **Update dependency**: `pnpm add @oliviermtlbali/ust-calc@latest`

2. **Replace `lib/calculatePriceByDistanceAndDuration.js`**:
   ```javascript
   import { calculateDeliveryPrices } from '@oliviermtlbali/ust-calc'
   ```

3. **Update `lib/utils.js` `getOriginAddress()`**:
   ```javascript
   import { calculateDeliveryPrices, selectOptimalOrigin } from '@oliviermtlbali/ust-calc'
   ```

4. **Update `PlacesAutocompleteNew.jsx`**:
   ```javascript
   import { createGoogleMapsService, DELIVERY_ORIGINS } from '@oliviermtlbali/ust-calc/browser'
   ```

5. **Delete deprecated files** after migration verified

### Phase 4: Update punsch-taxi.at (Dogfooding)

1. Replace local imports with shared package imports
2. Delete local service/utility files
3. Verify all tests pass

---

## Critical Files

### To Create (lib/ust-calc)
- `src/delivery/types.ts`
- `src/delivery/constants.ts`
- `src/delivery/price-calculator.ts`
- `src/delivery/origin-selector.ts`
- `src/delivery/address-utils.ts`
- `src/delivery/index.ts`
- `src/browser/google-maps-service.ts`
- `src/browser/address-parser.ts`
- `src/browser/address-handler.ts`
- `src/browser/types.ts`
- `src/browser/index.ts`
- `tests/delivery.test.ts`

### To Modify (lib/ust-calc)
- `src/index.ts` - Add delivery exports
- `tsup.config.ts` - Dual entry points
- `package.json` - Version bump + exports field

### To Migrate (punsch-taxi-dashboard)
- `lib/calculatePriceByDistanceAndDuration.js` → delete
- `lib/utils.js` → update imports
- `components/Quote/components/AddressField/PlacesAutocompleteNew.jsx` → update imports

### To Migrate (punsch-taxi.at)
- `src/services/google-maps.service.ts` → delete
- `src/lib/address-selection-handler.ts` → delete
- `src/lib/delivery-price-calculator.ts` → delete
- `src/lib/address-utils.ts` → delete
- Components importing these → update imports

### To Migrate (catering.creperie-mobile.at) - Phase 5
- Same files as punsch-taxi.at (verify structure first)

### Other ust-calc Consumers (Verify No Impact)
- `catering-quoter-server` - Backend, likely VAT only
- `invoicepunschtaxi.herokuapp.com` - Backend, likely VAT only

---

## Verification Plan

1. **Unit Tests**: Run `pnpm test` in ust-calc after adding delivery functions
2. **Equivalence Tests**: Compare output of shared functions vs existing implementations
3. **Build Verification**: Ensure dual entry points build correctly
4. **Integration Test (Dashboard)**: Test address selection flow end-to-end
5. **Integration Test (punsch-taxi.at)**: Verify checkout still works

---

## Decisions Made

1. **Package scope**: Expand ust-calc with `/browser` entry point (single package)
2. **Departure time**: Use fixed future date (2040) for consistent distance matrix results
3. **Christmas logic**: Implement now - always prefer Wien origin during December/January

---

## Critical Issues from Review (Must Address)

### 1. Type Safety - Pure Layer Must Not Depend on google.maps.*

**Problem**: Current types reference `google.maps.DistanceMatrixElementStatus` enum, making "pure" functions impure.

**Solution**: Use string literal union types in pure layer:
```typescript
// src/delivery/types.ts - PURE LAYER
export type DistanceStatus = 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_DIMENSIONS_EXCEEDED'

export interface DistanceResult {
  origin: DeliveryOrigin
  distance: { text: string; value: number }
  duration: { text: string; value: number }
  status: DistanceStatus  // String literal, NOT google.maps.*
}
```

### 2. Timezone Handling for Christmas Season

**Problem**: Christmas detection not timezone-aware.

**Solution**:
```typescript
export function isChristmasSeason(
  date: Date = new Date(),
  timezone: string = 'Europe/Vienna'
): boolean {
  const viennaDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))
  const month = viennaDate.getMonth()
  const day = viennaDate.getDate()
  return (month === 11 && day >= 1) || (month === 0 && day <= 15)
}
```

### 3. Error Handling Strategy

Add to browser layer:
- **API key validation**: Throw immediately if missing
- **Rate limiting**: Retry with exponential backoff (max 3 attempts)
- **Timeout**: 5-second timeout with AbortController
- **Status validation**: Check `status === 'OK'` before using results

### 4. Data Format Compatibility (originsArray)

Dashboard expects `originsArray` in raw Google format for form prefilling.

**Solution**: Add compatibility wrapper in browser layer:
```typescript
// src/browser/address-handler.ts
export interface AddressSelectionResult {
  // ... existing fields
  originsArray?: RawDistanceMatrixResponse[]  // For dashboard backward compatibility
}
```

### 5. Decimal.js Consistency

**Decision**: Use Decimal.js in delivery calculations for consistency with core VAT functions.

```typescript
const d = (v: number) => new Decimal(v)
const costTotal = driverCost.plus(gasCost)
return {
  single: costTotal.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
  double: costTotal.times(2).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}
```

---

## Missing Project: catering.creperie-mobile.at

This project also uses ust-calc and likely needs the same migration. Add as **Phase 5**.

---

## Rollback Strategy

1. **Git tags**: Tag each ust-calc release before publishing
2. **Beta versions**: Publish as `v2.0.0-beta.1` first, test for 2 weeks
3. **npm unpublish**: Can unpublish within 72 hours if critical issues
4. **Pinned versions**: Consumers should pin exact version during migration
5. **Feature flags**: Dashboard can import from old local files until verified

---

## Versioning Strategy

- **v1.2.0**: If only adding new exports (non-breaking)
- **v2.0.0**: If package.json exports field changes bundler behavior

**Recommendation**: v2.0.0-beta.1 → v2.0.0 after validation

---

## Updated Phasing

1. **Phase 1**: Pure delivery functions (NO google.maps.* dependencies)
2. **Phase 1.5**: punsch-taxi.at imports Phase 1 functions (dogfooding)
3. **Phase 2**: Browser code with Google Maps integration
4. **Phase 2.5**: Browser integration tests
5. **Phase 3**: Migrate punsch-taxi-dashboard
6. **Phase 4**: Delete local files from punsch-taxi.at
7. **Phase 5**: Migrate catering.creperie-mobile.at

---

## Testing Strategy (Required Before Migration)

### Unit Tests (Phase 1)
- `calculateDeliveryPrices`: Edge cases (0 distance, extreme duration, Decimal.js precision)
- `selectOptimalOrigin`: No valid results, Wien preference, Christmas season
- `isChristmasSeason`: Date boundaries (Dec 1 00:00, Jan 15 23:59), timezone handling
- `validateAddressHasStreetNumber`: False positives ("20er Haus"), complex numbers ("12a/3")

### Equivalence Tests (Phase 1.5)
- Run 50+ real Austrian addresses through old AND new code
- Verify prices match within 1 cent tolerance
- Verify origin selection matches (except intentional Christmas change)
- Document any intentional behavior differences

### Integration Tests (Phase 2.5)
- Mock Google Maps API responses
- Test rate limit handling (mock OVER_QUERY_LIMIT)
- Test timeout behavior (mock slow responses)
- Test API key validation (missing/invalid key)

### E2E Tests (Phase 3+)
- Full address selection flow in dashboard
- Full checkout flow in punsch-taxi.at
- Verify originsArray format compatibility

---

## Estimated Scope (Updated)

- **Phase 1** (Pure functions): 6 new files + tests (~8 hours)
- **Phase 1.5** (Dogfooding): Update punsch-taxi.at imports (~2 hours)
- **Phase 2** (Browser code): 5 new files (~6 hours)
- **Phase 2.5** (Integration tests): Mock tests (~4 hours)
- **Phase 3** (Dashboard migration): 3 files to update (~4 hours)
- **Phase 4** (punsch-taxi.at cleanup): Delete local files (~2 hours)
- **Phase 5** (catering migration): Similar to Phase 4 (~2 hours)

**Total**: ~28 hours of implementation + testing
