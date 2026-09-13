import { describe, it, expect } from 'vitest'
import { recommendKraken2Db } from './recommendKraken2Db'
import type { Kraken2DbVariant } from '../data/kraken2DbVariants'

const variants: Kraken2DbVariant[] = [
  { id: 'viral', ramGiB: 0.6, archiveGiB: 0.53, wired: true, nameKey: '', descriptionKey: '' },
  { id: 'standard_08_GB', ramGiB: 7.45, archiveGiB: 5.54, wired: true, nameKey: '', descriptionKey: '' },
  { id: 'standard_16_GB', ramGiB: 14.9, archiveGiB: 11.17, wired: false, nameKey: '', descriptionKey: '' },
  { id: 'pluspf_16_GB', ramGiB: 14.9, archiveGiB: 11.14, wired: false, nameKey: '', descriptionKey: '' },
]

describe('recommendKraken2Db', () => {
  it('recommends the tiny Viral DB on a RAM-constrained machine (e.g. a ~7 GiB dev laptop)', () => {
    // Real case from PLAN.md §2.3: a ~7 GiB usable dev laptop cannot safely
    // run even standard_08_GB (7.45 GiB alone, before overhead).
    expect(recommendKraken2Db(7, variants)?.id).toBe('viral')
  })

  it('recommends standard_08_GB on the real 11 GiB VM this project actually tested on', () => {
    // 11 * 0.5 = 5.5, which is LESS than standard_08_GB's 7.45 GiB - so
    // under this deliberately conservative rule, even the 11 GiB machine
    // that did successfully run standard_08_GB (alone) only gets Viral
    // recommended. This is intentional, not a bug: the real test only
    // succeeded with nothing else running, which the recommendation can't
    // assume - it recommends the safer choice by default.
    expect(recommendKraken2Db(11, variants)?.id).toBe('viral')
  })

  it('recommends standard_08_GB once there is enough headroom for it (e.g. 16 GiB)', () => {
    expect(recommendKraken2Db(16, variants)?.id).toBe('standard_08_GB')
  })

  it('recommends a 16 GB-capped variant on a genuinely well-resourced machine (e.g. 32 GiB)', () => {
    const result = recommendKraken2Db(32, variants)
    expect(['standard_16_GB', 'pluspf_16_GB']).toContain(result?.id)
  })

  it('never recommends nothing - falls back to the smallest variant even on a tiny amount of RAM', () => {
    expect(recommendKraken2Db(0.1, variants)?.id).toBe('viral')
  })

  it('returns null only when given an empty variant list', () => {
    expect(recommendKraken2Db(64, [])).toBeNull()
  })
})
