import { describe, it, expect } from 'vitest'
import en from './locales/en.json'
import fr from './locales/fr.json'

// Cheap, high-value regression test: catches translation drift the moment
// it happens (a key added to one locale and forgotten in the other) rather
// than someone noticing missing/English-fallback text in the French UI by
// eye. PLAN.md §6.16: French/English switching is a must-have, so silently
// incomplete translations are a real regression, not a cosmetic nitpick.
function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix]
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    collectKeyPaths(value, prefix ? `${prefix}.${key}` : key),
  )
}

describe('i18n locale files', () => {
  it('en and fr have exactly the same set of translation keys', () => {
    const enKeys = collectKeyPaths(en).sort()
    const frKeys = collectKeyPaths(fr).sort()
    expect(frKeys).toEqual(enKeys)
  })

  it('every tool in the catalog category list has a name and description in both locales', () => {
    // Real content assertion, not just "keys exist" - matches this
    // project's own established standard (docs/KNOWN_ISSUES.md Fixed
    // #13/#15: never assert existence alone).
    for (const locale of [en, fr] as const) {
      for (const [toolId, entry] of Object.entries(locale.tools)) {
        expect(entry.name.trim().length, `${toolId}.name should not be empty`).toBeGreaterThan(0)
        expect(entry.description.trim().length, `${toolId}.description should not be empty`).toBeGreaterThan(0)
      }
    }
  })
})
