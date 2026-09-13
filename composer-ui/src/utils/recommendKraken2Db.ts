import { KRAKEN2_DB_VARIANTS, type Kraken2DbVariant } from '../data/kraken2DbVariants'

// Recommends the largest Kraken2 DB variant whose RAM requirement leaves
// real headroom on the given amount of available RAM - deliberately
// conservative (at most half of available RAM), not "does it technically
// fit." Grounded in a real finding from this project's own real-data
// testing (docs/planning/PLAN.md §2.3, docs/KNOWN_ISSUES.md "Real-data
// validation"): on an 11 GiB VM, the 7.45 GiB standard_08_GB DB *did* load
// and classify correctly, but only when run ALONE with nothing else
// memory-heavy active - running it concurrently with a real MEGAHIT
// assembly OOM-killed the assembly (Docker exit 137). That's ~68% RAM
// utilization by the DB alone already leaving no room for a real pipeline
// run's other concurrent stages - a 50% ceiling is a deliberately safer
// margin than what was observed to already be too tight, not an arbitrary
// number.
export const RECOMMENDATION_RAM_FRACTION = 0.5

export function recommendKraken2Db(availableRamGiB: number, variants: Kraken2DbVariant[] = KRAKEN2_DB_VARIANTS): Kraken2DbVariant | null {
  const budget = availableRamGiB * RECOMMENDATION_RAM_FRACTION
  const fitting = variants.filter((v) => v.ramGiB <= budget)
  if (fitting.length > 0) {
    return fitting.reduce((largest, v) => (v.ramGiB > largest.ramGiB ? v : largest))
  }
  // Nothing comfortably fits (a very RAM-constrained machine) - fall back
  // to the smallest real variant rather than recommending nothing at all;
  // the UI still shows the real numbers so the user can judge for
  // themselves whether even that is safe on their machine.
  if (variants.length === 0) return null
  return variants.reduce((smallest, v) => (v.ramGiB < smallest.ramGiB ? v : smallest))
}
