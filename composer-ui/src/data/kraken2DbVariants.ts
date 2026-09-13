// Real Kraken2 database variants, grounded in docs/planning/PLAN.md §2.3's
// researched table (sizes verified 2026-09-11 via the S3 bucket's own
// listing/HEAD requests, not guessed) - owner request 2026-09-13: "let the
// user select which version they want, and have one written as
// (recommended) based on their hardware."
//
// Deliberately NOT the full PLAN.md table (9 rows including MinusB and the
// PlusPFP family) - scoped to the four variants that are either already
// downloadable via bin/download-dbs.sh today (`wired: true`) or are the
// documented near-term prod candidates (§2.3's own "Recommendation for
// animal-derived samples: PlusPF-16..." line) - the others are real but not
// yet prioritized anywhere in this project, and listing them would add
// noise without adding a decision anyone's actually facing yet.
export interface Kraken2DbVariant {
  id: string
  // RAM the variant's hash.k2d needs to load for classification - this is
  // the number the recommendation logic (recommendKraken2Db.ts) actually
  // reasons about, not the download/archive size.
  ramGiB: number
  archiveGiB: number
  // Whether `bin/download-dbs.sh <id>` actually works today - the script's
  // own case statement explicitly rejects standard_16_GB/pluspf_16_GB as
  // "isn't wired up yet" (checked directly against bin/download-dbs.sh,
  // not assumed from the PLAN.md table alone).
  wired: boolean
  nameKey: string
  descriptionKey: string
}

export const KRAKEN2_DB_VARIANTS: Kraken2DbVariant[] = [
  { id: 'viral', ramGiB: 0.6, archiveGiB: 0.53, wired: true, nameKey: 'kraken2db.viral.name', descriptionKey: 'kraken2db.viral.description' },
  { id: 'standard_08_GB', ramGiB: 7.45, archiveGiB: 5.54, wired: true, nameKey: 'kraken2db.standard_08_GB.name', descriptionKey: 'kraken2db.standard_08_GB.description' },
  { id: 'standard_16_GB', ramGiB: 14.9, archiveGiB: 11.17, wired: false, nameKey: 'kraken2db.standard_16_GB.name', descriptionKey: 'kraken2db.standard_16_GB.description' },
  { id: 'pluspf_16_GB', ramGiB: 14.9, archiveGiB: 11.14, wired: false, nameKey: 'kraken2db.pluspf_16_GB.name', descriptionKey: 'kraken2db.pluspf_16_GB.description' },
]

// The conventional extract path bin/download-dbs.sh uses by default
// ($HOME/microbox-dbs/kraken2/<variant>, see its own DEFAULT_TARGET_DIR/
// EXTRACT_DIR logic) - offered in the UI as a copyable starting point for
// the kraken2_db path field, NOT a claim this app can see the user's real
// filesystem (it can't - this is a browser app with no disk access). Stays
// fully editable; a "~" is a real, portable placeholder every shell expands
// on its own, not something this app resolves.
export function conventionalKraken2DbPath(variantId: string): string {
  return `~/microbox-dbs/kraken2/${variantId}`
}
