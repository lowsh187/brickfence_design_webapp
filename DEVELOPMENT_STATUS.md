# Development Status

Last updated: 2026-05-25

This document summarizes the current important development changes, available features, implementation details, and known follow-up items for the fence cost calculator.

## Current Git State

- Latest pushed commit on `main`: `b9a0ddf Improve pricing admin and fence preview behavior`
- The commit has been pushed to `origin/main`.
- Validation before push:
  - `npm.cmd run lint`

Local notes:

- `public/locales/en/translation.json` and `public/locales/zh/translation.json` may appear modified due to line-ending state, but their content diff is empty.
- `{console.error(e)` is a zero-byte accidental local file and is not part of the submitted work.

## Major Functional Areas

## 1. Frontend Calculator Flow

The calculator flow is split into:

- Start page
- Dimensions page
- Bond / cut brick / pier page
- Cost page

Core state is stored in `src/context/FormContext.tsx`.

Important behavior:

- The form no longer starts with default selections.
- Starting a new quote resets the form state.
- The Dimensions page requires the user to explicitly choose standard brick size or custom brick size.
- Back navigation clears the options from the current step and later steps.
- The persistent preview is also driven by this cleared state, so it does not keep stale bond, cut brick, or pier settings after Back.

Key files:

- `src/context/FormContext.tsx`
- `src/screens/StartPage.tsx`
- `src/screens/DimensionsPage.tsx`
- `src/screens/BondPage.tsx`
- `src/App.tsx`

## 2. Bond Patterns and Brick Generation

Bond generation lives under `src/bonds`.

Supported bond patterns include:

- Stretcher
- Stack
- Header
- English
- English garden wall
- Flemish
- Flemish garden wall

Recent changes:

- English bond was adjusted so invalid adjacent cut bricks are avoided.
- If an adjusted brick would be below the minimum cut limit, the wall length is adjusted instead of producing an invalid cut.
- Flemish pier display was corrected to use the same common pier face logic as the other bonds, instead of a special Flemish-only pier face that looked inconsistent.

Key files:

- `src/bonds/english.ts`
- `src/bonds/flemish.ts`
- `src/bonds/flemishGarden.ts`
- `src/bonds/cutRules.ts`
- `src/components/FenceDiagram.tsx`

## 3. Pier Layout and Preview

Pier rendering is handled mainly by `src/components/FenceDiagram.tsx`.

Supported pier types:

- No piers
- Hidden piers
- Exposed piers

Supported pier sizes:

- `1_5x1`
- `1_5x1_5`
- `2x1`
- `2x2`

Important rules:

- Stack hidden piers only support `2x1` and `2x2`.
- Stack and stretcher exposed piers only support `2x2`.
- Pier spacing is capped at 3m.
- Pier height is capped at 2.5m.
- Hidden piers render only the visible reveal above the wall face.
- Exposed piers render the full pier face and visually separate wall bays.

Recent behavior fix:

- Selecting Back from the pier step clears pier type, size, height, spacing, and infill selection.
- Selecting a different bond clears cut brick and pier-related selections.
- Selecting a different cut brick option clears pier-related selections.
- Pier size is no longer auto-selected after choosing a pier type; the user must pick it.

## 4. Fence Infill

Fence infill is selected in the pier step and only appears when piers are enabled.

Current infill options:

- None
- Timber fence
- PVC fence

Costing:

- Timber fence is priced with key `timber_fence`.
- PVC fence is priced with key `pvc_fence`.
- Both currently use unit `m`.
- Infill cost is calculated as:

```ts
renderedLengthM * normalizeUnitPrice(prices.timber_fence)
renderedLengthM * normalizeUnitPrice(prices.pvc_fence)
```

Key files:

- `src/pricing.ts`
- `src/screens/CostPage.tsx`
- `src/components/FenceDiagram.tsx`

## 5. Cost Calculation

Cost calculation is centralized in `src/pricing.ts`.

Current cost categories:

- Standard brick
- Mortar
- Labour
- Bond-specific labour
- Timber fence infill
- PVC fence infill

The main cost function is `calculateCostPricing`.

It calculates:

- `brickCost`
- `mortarCost`
- `mortarDryMixKg`
- `mortarBagCount`
- `labourCost`
- `infillCost`
- `totalCost`

Important implementation details:

- Brick price can be `each` or `per_quantity`.
- Mortar can be priced by `per_bag` or `m3`.
- Mortar bag weight is configurable through `bagWeightKg`.
- Labour cost is selected by bond pattern through `LABOUR_PRICING_KEY_BY_BOND_PATTERN`.
- If the bond-specific labour price is not found, the code falls back to `labour`.

Bond-specific labour keys:

- `stretcher_bond_labour_cost`
- `stack_bond_labour_cost`
- `header_bond_labour_cost`
- `english_bond_labour_cost`
- `english_garden_bond_labour_cost`
- `flemish_bond_labour_cost`
- `flemish_garden_bond_labour_cost`

## 6. Admin Pricing Items

Payload collection: `pricing-items`

Key file:

- `src/payload/collections/PricingItems.ts`

Admin behavior:

- Pricing items are grouped by category:
  - Brick
  - Mortar
  - Labour
  - Fence infill
- Once a category is selected, the allowed key options are filtered.
- Once a key is selected, the allowed unit options are filtered.
- Unit options include custom unit support.
- Labour pricing is manual-only.
- Labour unit is `per_brick`.
- Supplier price source options are hidden/disabled for labour.

Price source modes:

- Manual price
- Supplier average price
- Specific supplier price

Final price display:

- The list view shows final price and final source.
- The final price uses the configured source first, then falls back to available supplier average where applicable.

## 7. Supplier Price Sources

Payload collection: `supplier-price-sources`

Key files:

- `src/payload/collections/SupplierPriceSources.ts`
- `src/app/admin/fetch-supplier-prices/route.ts`
- `src/supplierPricing.ts`

Supplier source behavior:

- A supplier source can be URL-based or manual.
- If `productUrl` is provided, supplier name is inferred from the URL.
- URL sources are updated by the admin fetch button.
- Manual sources are updated by editing and saving.
- Successful supplier prices can feed averages and selected supplier prices.

Supported supplier units by pricing key:

- `standard_brick`: `each`, `per_quantity`
- `mortar`: `per_bag`, `m3`
- `timber_fence`: `m`
- `pvc_fence`: `m`

Important fields:

- `lastPrice`
- `lastPriceDisplay`
- `previousPrice`
- `previousPriceDisplay`
- `lastStatus`
- `lastError`
- `unit`
- `unitQuantity`
- `bagWeightKg`

## 8. Supplier Price URL Parsing

The deterministic supplier parser is in `src/supplierPricing.ts`.

Current parsing flow:

1. Fetch supplier HTML with browser-like headers.
2. Apply URL-specific normalization, such as adding `change_state` for Austral / Brickworks state pages.
3. Extract title.
4. Try structured price from HTML attributes such as `data-price-amount`.
5. Try JSON-LD prices.
6. Try text prices like `$227.81`.
7. Infer unit from surrounding text.
8. If deterministic parsing is suspicious or incomplete, optionally use Gemini AI fallback.
9. Store price, unit, unit quantity, and bag weight into Payload.

Known deterministic parser limitation:

- It currently sorts all discovered prices and picks the lowest candidate when no structured price is found.
- This is dangerous on pages with related products or accessories.
- Example: the Fencing Direct PVC page contains the main railing price but also related product prices. The parser picked `$5.26` from a related post cap instead of the main `$227.81` price.
- The same page also has a date `6/30/2026`, and the unit parser incorrectly matched `/30` as `per_quantity: 30`.

Required future improvement for PVC fence URLs:

- Prefer main product price near the product title or product detail block.
- Ignore related products / add-ons / recommended products.
- For PVC railing panels, parse product length, e.g. `8' Long`, convert feet to metres, and normalize to `m`.
- Example expected normalization for the tested Fencing Direct page:
  - Sale price: `$227.81`
  - Length: `8 ft = 2.4384 m`
  - Approximate normalized price: `$93.43 per m`

## 9. Gemini AI Fallback

Gemini fallback is implemented in `src/supplierPriceAI.ts`.

Environment variable:

```env
GEMINI_API_KEY=...
```

Model:

```text
gemini-2.0-flash
```

The AI parser returns JSON:

```json
{
  "price": 123.45,
  "unit": "each",
  "unitQuantity": null,
  "bagWeightKg": null,
  "confidence": 0.9,
  "evidence": "matched text",
  "reason": "why this is the main product price"
}
```

Safety rules:

- AI result must have confidence >= 0.85.
- Price must be positive and finite.
- Unit must be present.
- Standard brick prices over `$20 each` are rejected as unsafe.
- Standard brick `per_quantity` must include a valid `unitQuantity`.
- Mortar `per_bag` can include `bagWeightKg`.

Current limitation:

- AI fallback is not currently triggered for all suspicious non-brick cases.
- PVC fence URL parsing still needs better deterministic checks or a broader AI fallback condition.

## 10. Pricing Data API and Caching

Frontend pricing is loaded from:

- `src/app/pricing-data/route.ts`

Recent cache behavior:

- The pricing endpoint uses no-store behavior so production does not serve stale pricing after admin changes.
- The frontend cost page fetches pricing data with `cache: 'no-store'`.

This is important because pricing is admin-managed and should update quickly after supplier or manual price changes.

## 11. Payload Schema and Generated Types

`payload-types.ts` was updated to match the Payload collection changes.

New/changed fields include:

- `unitQuantity`
- `customUnit`
- `bagWeightKg`
- supplier selected price display fields
- final price display fields
- bond-specific labour keys

If schema changes again, regenerate Payload types and ensure database migration/sync is handled before opening admin pages.

## Known Follow-Up Items

1. Improve PVC fence supplier parsing.
   - Main product price must be preferred over related products.
   - Product length should be converted to metres for `pvc_fence`.

2. Clean local workspace residue.
   - Remove the zero-byte `{console.error(e)` file.
   - Normalize or ignore the two translation files if only line-ending state changes remain.

3. Review Pull Request workflow.
   - The latest work was pushed directly to `main`.
   - Future team-reviewed work should use a feature branch and open a PR into `main`.

4. Consider database migration discipline.
   - Admin schema fields were changed.
   - Ensure the deployed database has columns such as `bag_weight_kg`, `unit_quantity`, and related display fields before admin collection pages are used.

5. Improve verification coverage when parser behavior changes.
   - Re-check pages with related products.
   - Re-check `per 500`, `per 1000`, `per bag`, and PVC panel length conversion cases after parser updates.

