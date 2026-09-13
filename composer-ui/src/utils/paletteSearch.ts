// Case-insensitive substring match against any of the given texts - PLAN.md
// §6.16's node-palette nice-to-have: "search/filter within the palette."
// Pure and translation-agnostic: NodePalette.tsx passes in the already-
// translated name/description for the CURRENT language, so searching in
// French filters against the French text and vice versa, not the English
// source strings.
export function matchesSearch(query: string, ...texts: string[]): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  return texts.some((text) => text.toLowerCase().includes(normalizedQuery))
}
