import { describe, it, expect } from 'vitest'
import { convertCanvasToParams } from './pipelineConverter'
import type { ToolNodeType } from '../components/ToolNode'

function node(id: string, toolId: string, params: Record<string, string> = {}, enabled = true): ToolNodeType {
  return { id, type: 'tool', position: { x: 0, y: 0 }, data: { toolId, params, enabled } }
}

describe('convertCanvasToParams', () => {
  it('an empty canvas skips every stage for the given family', () => {
    const params = convertCanvasToParams('metagenomics', [])
    expect(params.pipeline).toBe('metagenomics')
    expect(params.skip_fastp).toBe(true)
    expect(params.skip_megahit).toBe(true)
    expect(params.skip_kraken2).toBe(true)
  })

  it('a node present and enabled on canvas turns its stage on', () => {
    const params = convertCanvasToParams('metagenomics', [node('n1', 'fastp'), node('n2', 'kraken2', { kraken2_db: '/data/db' })])
    expect(params.skip_fastp).toBe(false)
    expect(params.skip_kraken2).toBe(false)
    expect(params.kraken2_db).toBe('/data/db')
    // Not on canvas at all - stays off.
    expect(params.skip_fastqc).toBe(true)
  })

  it('a disabled node (canvas skip toggle) is treated the same as absent', () => {
    const params = convertCanvasToParams('metagenomics', [node('n1', 'fastp', {}, false)])
    expect(params.skip_fastp).toBe(true)
  })

  it('a disabled node\'s stale param value never leaks into the output', () => {
    const params = convertCanvasToParams('metagenomics', [node('n1', 'kraken2', { kraken2_db: '/stale/path' }, false)])
    expect(params.kraken2_db).toBeUndefined()
  })

  it('megahit and metaspades share skip_megahit - whichever is present sets params.assembler', () => {
    const withMegahit = convertCanvasToParams('metagenomics', [node('n1', 'megahit')])
    expect(withMegahit.skip_megahit).toBe(false)
    expect(withMegahit.assembler).toBe('megahit')

    const withMetaspades = convertCanvasToParams('metagenomics', [node('n1', 'metaspades')])
    expect(withMetaspades.skip_megahit).toBe(false)
    expect(withMetaspades.assembler).toBe('metaspades')

    const withNeither = convertCanvasToParams('metagenomics', [])
    expect(withNeither.skip_megahit).toBe(true)
    expect(withNeither.assembler).toBeUndefined()
  })

  it('a metagenomics-only node on a wgs-family conversion is ignored (families are disjoint)', () => {
    const params = convertCanvasToParams('wgs', [node('n1', 'fastp')])
    // fastp has no meaning in the wgs family - no skip_fastp key at all, not
    // a false one, and no metagenomics flags leak into a wgs params object.
    expect(params.skip_fastp).toBeUndefined()
  })

  it('real WGS conversion: bwamem2 + gatk4 enabled, reference path carried through', () => {
    const params = convertCanvasToParams('wgs', [
      node('n1', 'bwamem2', { wgs_reference_fasta: '/refs/NC_007795.1.fasta' }),
      node('n2', 'gatk4'),
    ])
    expect(params.pipeline).toBe('wgs')
    expect(params.skip_bwamem2).toBe(false)
    expect(params.skip_gatk4).toBe(false)
    expect(params.wgs_reference_fasta).toBe('/refs/NC_007795.1.fasta')
    expect(params.skip_kraken2_wgs).toBe(true)
    expect(params.skip_mash).toBe(true)
    expect(params.skip_seqkit_stats).toBe(true)
  })

  it('kraken2wgs and the metagenomics kraken2 node both use the real kraken2_db param key', () => {
    const wgs = convertCanvasToParams('wgs', [node('n1', 'kraken2wgs', { kraken2_db: '/data/db' })])
    expect(wgs.kraken2_db).toBe('/data/db')
    expect(wgs.skip_kraken2_wgs).toBe(false)
  })
})
