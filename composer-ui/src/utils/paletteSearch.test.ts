import { describe, it, expect } from 'vitest'
import { matchesSearch } from './paletteSearch'

describe('matchesSearch', () => {
  it('matches when the query is a substring of any given text, case-insensitively', () => {
    expect(matchesSearch('kra', 'Kraken2', 'Taxonomic classification')).toBe(true)
    expect(matchesSearch('KRAKEN', 'Kraken2', 'Taxonomic classification')).toBe(true)
    expect(matchesSearch('taxonomic', 'Kraken2', 'Taxonomic classification')).toBe(true)
  })

  it('does not match when the query appears in none of the given texts', () => {
    expect(matchesSearch('assembler', 'Kraken2', 'Taxonomic classification')).toBe(false)
  })

  it('treats an empty or whitespace-only query as matching everything', () => {
    expect(matchesSearch('', 'anything')).toBe(true)
    expect(matchesSearch('   ', 'anything')).toBe(true)
  })

  it('trims surrounding whitespace from the query before matching', () => {
    expect(matchesSearch('  kraken2  ', 'Kraken2')).toBe(true)
  })
})
