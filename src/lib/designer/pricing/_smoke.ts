// Phase 1 Task 1.1 type-resolution smoke probe.
// Removed in Task 3.7 once the real barrel re-exports the package.
import type { GarmentFamily, EmbroideryPriceResult } from '@print-room-studio/pricing'

export const _smoke: { fam: GarmentFamily; res: EmbroideryPriceResult | null } = {
  fam: 'apparel',
  res: null,
}
